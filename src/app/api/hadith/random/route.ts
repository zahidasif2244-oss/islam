import { createQuranClient, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT hadees_number, BookUR, Baab_Eng, Kitab_Eng, Baab, Kitab, Arabic, Ravi, Urdu, English, Volume FROM tbl_random_hadees ORDER BY RANDOM() LIMIT 1')
  if (!rows.length) return error('No hadith found')
  const r = rows[0]
  return json({
    hadees_number: r.hadees_number, book_ur: getText(r.BookUR),
    baab_eng: getText(r.Baab_Eng), kitab_eng: getText(r.Kitab_Eng),
    baab: getText(r.Baab), kitab: getText(r.Kitab),
    arabic: getText(r.Arabic), ravi: getText(r.Ravi),
    urdu: getText(r.Urdu), english: getText(r.English),
    volume: getText(r.Volume)
  })
}
