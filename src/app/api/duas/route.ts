import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT * FROM tbl_dua ORDER BY dua_seq')
  const duas = rows.map(r => ({
    id: r.dua_ID, title: getText(r.dua_title), seq: r.dua_seq,
    desc: getText(r.dua_desc), arabic: getText(r.dua_arabic),
    urdu: getText(r.dua_urdu), english: getText(r.dua_eng),
    ref: getText(r.dua_ref), source: 'tbl_dua'
  }))
  return json(duas, 200, 86400)
}
