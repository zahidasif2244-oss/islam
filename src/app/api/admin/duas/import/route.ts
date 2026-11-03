import { createQuranClient, run, query } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { isDuaTable, resolveDuaTable } from '@/lib/dua-tables'
import { duaKey } from '@/lib/dua-titles'
import { saveDuaOverride } from '@/lib/dua-overrides'

export const dynamic = 'force-dynamic'

function clean(v: unknown, max = 20000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

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

    const maxId = Number((await query(db, `SELECT COALESCE(MAX(dua_ID),0) AS m FROM ${real}`))[0].m)
    const maxSeq = Number((await query(db, `SELECT COALESCE(MAX(dua_seq),0) AS m FROM ${real}`))[0].m)

    let nextId = maxId
    let nextSeq = maxSeq
    let inserted = 0
    const skipped: number[] = []

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
      await run(
        db,
        `INSERT INTO ${real} (dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nextId, title, seq, desc, arabic, urdu, english, ref]
      )
      // Public duas are a static file; keep the small overlay in sync so an
      // import shows up on the website immediately instead of after a rebuild.
      await saveDuaOverride({
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
      inserted++
    }

    return json({ success: true, table, inserted, skipped })
  } catch (e: any) {
    return error(e.message || 'Import failed', 500)
  }
}