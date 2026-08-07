import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const TABLES = [
  ['tbl_dua', 'dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref'],
  ['tbl_dua_Urdu', 'dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref'],
  ['tbl_prayer', 'dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref'],
  ['tbl_namaz_e_janaza', 'dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref'],
  ['tbl_roza', 'dua_ID', 'dua_title', 'dua_seq', 'dua_desc', 'dua_arabic', 'dua_urdu', 'dua_eng', 'dua_ref'],
]

export async function GET() {
  const db = createQuranClient()
  const results = await Promise.allSettled(
    TABLES.map(async ([table, ...cols]) => {
      const rows = await query(db, `SELECT ${cols.join(',')} FROM ${table} ORDER BY dua_seq`)
      return rows.map(r => ({
        id: r[cols[0]], title: getText(r[cols[1]]), seq: r[cols[2]],
        desc: getText(r[cols[3]]), arabic: getText(r[cols[4]]),
        urdu: getText(r[cols[5]]), english: getText(r[cols[6]]),
        ref: getText(r[cols[7]]), source: table
      }))
    })
  )
  const allDuas = results.filter(r => r.status === 'fulfilled').flatMap(r => (r as PromiseFulfilledResult<any[]>).value)
  allDuas.sort((a, b) => a.source.localeCompare(b.source) || (a.seq || 0) - (b.seq || 0))
  return json(allDuas, 200, 0)
}
