import type { InStatement } from '@libsql/client'
import { createQuranClient, query } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { isDuaTable, resolveDuaTable } from '@/lib/dua-tables'
import { duaKey } from '@/lib/dua-titles'
import {
  duaOverrideStatement,
  ensureDuaOverrides,
  invalidateDuaOverrides,
} from '@/lib/dua-overrides'

export const dynamic = 'force-dynamic'

function clean(v: unknown, max = 20000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

/** Keep each HTTP batch comfortably below request-size limits. */
const ROWS_PER_BATCH = 100

export async function POST(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const table = clean(body.table)
    if (!isDuaTable(table)) return error('invalid table', 400)
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return error('rows array required', 400)

    const db = createQuranClient()
    const real = resolveDuaTable(table)

    // One read instead of two separate MAX() queries.
    const limits = await query(
      db,
      `SELECT COALESCE(MAX(dua_ID),0) AS max_id, COALESCE(MAX(dua_seq),0) AS max_seq FROM ${real}`
    )
    let nextId = Number((limits[0] as any)?.max_id || 0)
    let nextSeq = Number((limits[0] as any)?.max_seq || 0)
    let inserted = 0
    const skipped: number[] = []
    const statements: InStatement[] = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const title = clean(r?.title)
      if (!title) { skipped.push(i + 1); continue }

      const seqRaw = r?.seq
      const hasSeq = seqRaw !== undefined && seqRaw !== null && seqRaw !== ''
      const seq = hasSeq && !Number.isNaN(Number(seqRaw)) ? Number(seqRaw) : (nextSeq += 1)

      nextId += 1
      const desc = clean(r?.desc)
      const arabic = clean(r?.arabic)
      const urdu = clean(r?.urdu)
      const english = clean(r?.english)
      const ref = clean(r?.ref)

      statements.push({
        sql: `INSERT INTO ${real} (dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [nextId, title, seq, desc, arabic, urdu, english, ref],
      })
      // Public duas are a static file; keep the small overlay in sync so an
      // import shows up on the website immediately instead of after a rebuild.
      statements.push(
        duaOverrideStatement({
          key: duaKey(table, nextId, seq),
          table,
          id: nextId,
          seq,
          title,
          desc,
          arabic,
          urdu,
          english,
          ref,
          deleted: false,
        })
      )
      inserted++
    }

    if (statements.length) {
      await ensureDuaOverrides()
      for (let i = 0; i < statements.length; i += ROWS_PER_BATCH * 2) {
        await db.batch(statements.slice(i, i + ROWS_PER_BATCH * 2), 'write')
      }
      invalidateDuaOverrides()
    }

    return json({ success: true, table, inserted, skipped })
  } catch (e: any) {
    return error(e.message || 'Import failed', 500)
  }
}
