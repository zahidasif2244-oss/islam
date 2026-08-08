import { createQuranClient, run, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { DUA_TABLES, DUA_COLS, isDuaTable, resolveDuaTable } from '@/lib/dua-tables'

export const dynamic = 'force-dynamic'

function clean(v: unknown, max = 20000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

export async function GET(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const db = createQuranClient()
    const categories: any[] = []
    for (const [table, label] of DUA_TABLES) {
      const rows = await query(db, `SELECT ${DUA_COLS.join(',')} FROM ${resolveDuaTable(table)} ORDER BY dua_seq`)
      categories.push({
        source: table,
        label,
        count: rows.length,
        duas: rows.map((r: any) => ({
          id: r.dua_ID,
          title: getText(r.dua_title),
          seq: r.dua_seq,
          desc: getText(r.dua_desc),
          arabic: getText(r.dua_arabic),
          urdu: getText(r.dua_urdu),
          english: getText(r.dua_eng),
          ref: getText(r.dua_ref),
        })),
      })
    }
    return json({ categories })
  } catch (e: any) {
    return error(e.message || 'Failed to list duas', 500)
  }
}

export async function POST(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const table = clean(body.table)
    const dua = body.dua || body
    if (!isDuaTable(table)) return error('invalid table', 400)
    if (!dua || typeof dua !== 'object') return error('dua object required', 400)

    const id = dua.id ? Number(dua.id) : null
    const title = clean(dua.title)
    const desc = clean(dua.desc)
    const arabic = clean(dua.arabic)
    const urdu = clean(dua.urdu)
    const english = clean(dua.english)
    const ref = clean(dua.ref)
    const seqRaw = dua.seq
    const seq = seqRaw !== undefined && seqRaw !== null && seqRaw !== '' ? Number(seqRaw) : null

    const db = createQuranClient()
    const real = resolveDuaTable(table)

    if (id) {
      await run(
        db,
        `UPDATE ${real} SET dua_title=?, dua_seq=?, dua_desc=?, dua_arabic=?, dua_urdu=?, dua_eng=?, dua_ref=? WHERE dua_ID=?`,
        [title, seq ?? 0, desc, arabic, urdu, english, ref, id]
      )
      return json({ success: true, action: 'updated', id, table })
    }

    const maxRows = await query(db, `SELECT COALESCE(MAX(dua_ID),0) AS m FROM ${real}`)
    const newId = Number((maxRows[0] as any).m) + 1
    let newSeq = seq
    if (newSeq === null || newSeq === undefined) {
      const seqRows = await query(db, `SELECT COALESCE(MAX(dua_seq),0) AS m FROM ${real}`)
      newSeq = Number((seqRows[0] as any).m) + 1
    }
    await run(
      db,
      `INSERT INTO ${real} (dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, title, newSeq, desc, arabic, urdu, english, ref]
    )
    return json({ success: true, action: 'inserted', id: newId, seq: newSeq, table })
  } catch (e: any) {
    return error(e.message || 'Failed to save dua', 500)
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const table = clean(body.table)
    const id = Number(body.id)
    if (!isDuaTable(table)) return error('invalid table', 400)
    if (!id) return error('id required', 400)
    const db = createQuranClient()
    await run(db, `DELETE FROM ${resolveDuaTable(table)} WHERE dua_id = ?`, [id])
    return json({ success: true })
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}