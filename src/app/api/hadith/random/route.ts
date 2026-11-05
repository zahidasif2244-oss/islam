import { createQuranClient, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { createServerCache } from '@/lib/server-cache'

/**
 * One random hadith per five minutes, shared by every visitor on a warm
 * serverless instance. Concurrent cache misses share a single database read.
 */
const CACHE_TTL = 300_000
const NO_HADITH = 'NO_HADITH'

type RandomHadith = {
  hadees_number: unknown
  book_ur: string
  baab_eng: string
  kitab_eng: string
  baab: string
  kitab: string
  arabic: string
  ravi: string
  urdu: string
  english: string
  volume: string
}

const randomHadithCache = createServerCache<RandomHadith>('random-hadith', CACHE_TTL)

async function loadRandomHadith(): Promise<RandomHadith> {
  const db = createQuranClient()
  // Never let a slow/blocked database hang the client for half a minute.
  const rows = (await Promise.race([
    query(db, 'SELECT hadees_number, BookUR, Baab_Eng, Kitab_Eng, Baab, Kitab, Arabic, Ravi, Urdu, English, Volume FROM tbl_random_hadees ORDER BY RANDOM() LIMIT 1'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
  ])) as any[]
  if (!rows.length) throw new Error(NO_HADITH)
  const r = rows[0]
  return {
    hadees_number: r.hadees_number, book_ur: getText(r.BookUR),
    baab_eng: getText(r.Baab_Eng), kitab_eng: getText(r.Kitab_Eng),
    baab: getText(r.Baab), kitab: getText(r.Kitab),
    arabic: getText(r.Arabic), ravi: getText(r.Ravi),
    urdu: getText(r.Urdu), english: getText(r.English),
    volume: getText(r.Volume),
  }
}

export async function GET() {
  try {
    const result = await randomHadithCache.load(loadRandomHadith)
    return json(result, 200, 300)
  } catch (e: any) {
    if (e?.message === NO_HADITH) return error('No hadith found')
    return error('Failed to load random hadith')
  }
}
