import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT * FROM tbl_dua_Urdu ORDER BY dua_seq')
  const duas = rows.map(r => {
    const keys = Object.keys(r)
    return {
      id: r.dua_ID, title: getText(r.dua_title), seq: r.dua_seq,
      desc: getText(r.dua_desc), arabic: getText(r.dua_arabic),
      urdu: getText(r.dua_urdu), ref: getText(r.dua_ref),
      english: getText(r.dua_eng),
      popular: keys.length > 9 ? r[keys[9]] : 0,
      source: 'tbl_dua_Urdu'
    }
  })
  return json(duas, 200, 0)
}
