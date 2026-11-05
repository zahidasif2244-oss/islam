import type { Client } from '@libsql/client'
import { createQuranClient, query, run } from '@/lib/db'
import { error, json } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import {
  ensureTopicOverrides,
  invalidateTopicOverrides,
  readTopicOverrides,
  topicDeleteStatement,
  topicOverrideStatement,
  topicRestoreStatement,
  topicTombstoneStatement,
} from '@/lib/topic-overrides'
import {
  isTopicKind,
  normalizeTopic,
  topicRowKey,
  type TopicKind,
} from '@/lib/topic-merge'

export const dynamic = 'force-dynamic'

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

/**
 * IDs must clear both the baked file and every existing overlay row. The admin
 * page sends the baked maximum (the API does not bundle the 2,101-row JSON), and
 * this query adds the overlay maximum.
 */
async function nextTopicId(db: Client, kind: TopicKind, maxBaked: number): Promise<number> {
  const rows = await query(
    db,
    `SELECT COALESCE(MAX(topic_id), 0) AS max_id FROM tbl_TopicOverrides WHERE kind = ?`,
    [kind]
  )
  const maxOverlay = Number((rows[0] as any)?.max_id || 0)
  return Math.max(maxOverlay, Math.max(0, Math.trunc(maxBaked || 0))) + 1
}

/** Raw overlay rows for the admin page; it merges them with the static files. */
export async function GET(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const rows = await readTopicOverrides()
    return json({ rows })
  } catch (e: any) {
    return error(e.message || 'Failed to load topic overrides', 500)
  }
}

/**
 * Create or update one topic.
 *
 * Body: `{ kind, topic, create?: true, maxId?: number }` for a new row, or
 * `{ kind, id, custom, topic }` for an edit. `custom` records whether the row is
 * an admin-created topic (hard delete) or an edit of a baked one (tombstone).
 */
export async function POST(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const kind = body?.kind
    if (!isTopicKind(kind)) return error('kind must be "topics" or "amazing"', 400)

    const raw = body?.topic && typeof body.topic === 'object' ? body.topic : body
    const normalized = normalizeTopic(kind, raw)
    if (!normalized.ok) return error(normalized.error, 400)

    const db = createQuranClient()
    await ensureTopicOverrides(db)

    const create = body?.create === true
    const id = create ? await nextTopicId(db, kind, Number(body?.maxId) || 0) : intOrNull(body?.id)
    if (id === null || id <= 0) return error('id required', 400)

    const custom = create ? true : body?.custom === true
    const key = topicRowKey(kind, id)
    const statement = topicOverrideStatement({
      key,
      kind,
      id,
      ...normalized.value,
      custom,
      deleted: false,
    })
    await run(db, statement.sql, statement.args)
    invalidateTopicOverrides()

    return json({
      success: true,
      action: create ? 'inserted' : 'updated',
      row: {
        key,
        kind,
        id,
        ...normalized.value,
        custom,
        deleted: false,
      },
    })
  } catch (e: any) {
    return error(e.message || 'Failed to save topic', 500)
  }
}

/**
 * Delete, hide or restore one topic.
 *
 * Body: `{ kind, id, custom?: boolean, restore?: boolean }`.
 * - custom row: hard delete.
 * - baked row: tombstone so it can be restored later.
 * - `restore: true`: un-hide a previously tombstoned baked row.
 */
export async function DELETE(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const kind = body?.kind
    if (!isTopicKind(kind)) return error('kind must be "topics" or "amazing"', 400)

    const id = intOrNull(body?.id)
    if (id === null || id <= 0) return error('id required', 400)

    const db = createQuranClient()
    await ensureTopicOverrides(db)

    const restore = body?.restore === true
    const custom = body?.custom === true
    const statement = restore
      ? topicRestoreStatement(kind, id)
      : custom
        ? topicDeleteStatement(kind, id)
        : topicTombstoneStatement(kind, id)

    await run(db, statement.sql, statement.args)
    invalidateTopicOverrides()

    return json({
      success: true,
      action: restore ? 'restored' : custom ? 'deleted' : 'hidden',
      key: topicRowKey(kind, id),
      kind,
      id,
    })
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}
