import { createQuranClient, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

let cachedRandom: any = null
let lastFetch = 0
const CACHE_TTL = 300_000

export async function GET() {
  if (cachedRandom && Date.now() - lastFetch < CACHE_TTL) {
    return json(cachedRandom, 200, 300)
  }

  try {
    const db = createQuranClient()
    const rows = await query(db, 'SELECT hadees_number, BookUR, Baab_Eng, Kitab_Eng, Baab, Kitab, Arabic, Ravi, Urdu, English, Volume FROM tbl_random_hadees ORDER BY RANDOM() LIMIT 1')
    if (!rows.length) return error('No hadith found')
    const r = rows[0]
    const result = {
      hadees_number: r.hadees_number, book_ur: getText(r.BookUR),
      baab_eng: getText(r.Baab_Eng), kitab_eng: getText(r.Kitab_Eng),
      baab: getText(r.Baab), kitab: getText(r.Kitab),
      arabic: getText(r.Arabic), ravi: getText(r.Ravi),
      urdu: getText(r.Urdu), english: getText(r.English),
      volume: getText(r.Volume)
    }
    cachedRandom = result
    lastFetch = Date.now()
    return json(result, 200, 300)
  } catch {
    return error('Failed to load random hadith')
  }
}
