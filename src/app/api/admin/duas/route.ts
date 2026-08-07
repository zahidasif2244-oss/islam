import { createQuranClient, run, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const DUA_TABLES: [string, string][] = [
  ['tbl_dua', 'Duas'],
  ['tbl_dua_Urdu', 'More Duas'],
  ['tbl_prayer', 'Prayers'],
  ['tbl_namaz_e_janaza', 'Janaza'],
  ['tbl_roza', 'Roza'],
]

const TABLE_NAMES = new Set(DUA_TABLES.map(t => t[0]))
const TABLE_ALIASES: Record<string, string> = {
  tbl_dua: 'tbl_dua',
  tbl_dua_Urdu: 'tbl_dua_Urdu',
  tbl_prayer: 'tbl_prayer',
  tbl_namaz_e_janaza: 'tbl_namaz_e_janaza',
  tbl_roza: 'tbl_roza',
}
const COLS = ['dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref']

function isTable(t: string): boolean {
  return TABLE_NAMES.has(t)
}

function resolveTable(t: string): string {
  return TABLE_ALIASES[t] || t
}

function clean(v: unknown, max = 20000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

export async function GET() {
  try {
    const db = createQuranClient()
    const categories: any[] = []
    for (const [table, label] of DUA_TABLES) {
      const rows = await query(db, `SELECT ${COLS.join(',')} FROM ${resolveTable(table)} ORDER BY dua_seq`)
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
  try {
    const body = await req.json()
    const table = clean(body.table)
    const dua = body.dua || body
    if (!isTable(table)) return error('invalid table', 400)
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
    const real = resolveTable(table)

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
  try {
    const body = await req.json()
    const table = clean(body.table)
    const id = Number(body.id)
    if (!isTable(table)) return error('invalid table', 400)
    if (!id) return error('id required', 400)
    const db = createQuranClient()
    await run(db, `DELETE FROM ${resolveTable(table)} WHERE dua_id = ?`, [id])
    return json({ success: true })
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}