import { createQuranClient, query } from '@/lib/db'
import { error, json } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import {
  ensureTopicOverrides,
  invalidateTopicOverrides,
  topicOverrideStatement,
  type TopicStatement,
} from '@/lib/topic-overrides'
import {
  isTopicKind,
  normalizeTopic,
  topicRowKey,
  type TopicKind,
} from '@/lib/topic-merge'

export const dynamic = 'force-dynamic'

/** Keep each HTTP batch comfortably below request-size limits. */
const ROWS_PER_BATCH = 100

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== ''
}

/**
 * Import topics from the admin CSV.
 *
 * Body: `{ rows, kind?: fallback, maxId?: { topics, amazing } }`.
 * Rows with an id update that row (or un-hide it); rows without one get a new
 * id above both the baked file and the overlay. The client sends `custom` per
 * row so a missing baked id still becomes a normal admin-created topic.
 */
export async function POST(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const rows = Array.isArray(body?.rows) ? body.rows : []
    if (rows.length === 0) return error('rows array required', 400)

    const fallbackKind: TopicKind | null = isTopicKind(body?.kind) ? body.kind : null
    const bakedMaxInput = body?.maxId && typeof body.maxId === 'object' ? body.maxId : {}
    const bakedMax: Record<TopicKind, number> = {
      topics: Math.max(0, Math.trunc(Number((bakedMaxInput as any)?.topics) || 0)),
      amazing: Math.max(0, Math.trunc(Number((bakedMaxInput as any)?.amazing) || 0)),
    }

    const db = createQuranClient()
    await ensureTopicOverrides(db)

    const existingRows = await query(db, `SELECT row_key FROM tbl_TopicOverrides`)
    const existingKeys = new Set(existingRows.map((r: any) => String(r.row_key || '')))

    const maxRows = await query(
      db,
      `SELECT kind, COALESCE(MAX(topic_id), 0) AS max_id
         FROM tbl_TopicOverrides
        GROUP BY kind`
    )
    const next: Record<TopicKind, number> = { ...bakedMax }
    for (const row of maxRows as any[]) {
      const rowKind = row?.kind
      if (isTopicKind(rowKind)) {
        next[rowKind] = Math.max(next[rowKind], Number(row.max_id) || 0)
      }
    }

    let inserted = 0
    let updated = 0
    const skipped: Array<{ row: number; reason: string }> = []
    const statements: TopicStatement[] = []

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      const kindText = typeof raw?.kind === 'string' ? raw.kind.trim().toLowerCase() : ''
      const kind: TopicKind | null = kindText
        ? (isTopicKind(kindText) ? kindText : null)
        : fallbackKind
      if (!kind) {
        skipped.push({ row: i + 1, reason: 'invalid kind' })
        continue
      }

      const normalized = normalizeTopic(kind, raw)
      if (!normalized.ok) {
        skipped.push({ row: i + 1, reason: normalized.error })
        continue
      }

      const rawId = intOrNull(raw?.id)
      if (hasValue(raw?.id) && (rawId === null || rawId <= 0)) {
        skipped.push({ row: i + 1, reason: 'id must be a positive whole number' })
        continue
      }

      let id: number
      let custom: boolean
      if (rawId !== null) {
        id = rawId
        custom = typeof raw?.custom === 'boolean' ? raw.custom : id > bakedMax[kind]
        if (id > next[kind]) next[kind] = id
      } else {
        next[kind] += 1
        id = next[kind]
        custom = true
      }

      const key = topicRowKey(kind, id)
      // An id that belongs to a baked row is an edit even before the first
      // overlay row exists; other unseen ids are new admin-created rows.
      if (!custom || existingKeys.has(key)) {
        updated++
      } else {
        inserted++
      }
      existingKeys.add(key)

      statements.push(
        topicOverrideStatement({
          key,
          kind,
          id,
          ...normalized.value,
          custom,
          deleted: false,
        })
      )
    }

    for (let i = 0; i < statements.length; i += ROWS_PER_BATCH) {
      await db.batch(statements.slice(i, i + ROWS_PER_BATCH), 'write')
    }
    if (statements.length) invalidateTopicOverrides()

    return json({ success: true, inserted, updated, skipped })
  } catch (e: any) {
    return error(e.message || 'Import failed', 500)
  }
}
