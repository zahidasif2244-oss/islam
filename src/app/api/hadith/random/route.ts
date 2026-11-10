import { createQuranClient, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { createServerCache } from '@/lib/server-cache'

/**
 * A rotating pool of random hadiths, cached for a day per warm serverless
 * instance. One database read fills the pool and each request hands out the
 * next entry, so "Another" still returns a different hadith without touching
 * Turso again.
 *
 * The old five-minute TTL meant up to 288 full `ORDER BY RANDOM()` scans per
 * day per instance. A daily pool cuts that to one scan per day.
 */
const CACHE_TTL = 86_400_000
const POOL_SIZE = 100
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

const randomHadithPool = createServerCache<RandomHadith[]>('random-hadith-pool', CACHE_TTL)

function toHadith(r: any): RandomHadith {
  return {
    hadees_number: r.hadees_number, book_ur: getText(r.BookUR),
    baab_eng: getText(r.Baab_Eng), kitab_eng: getText(r.Kitab_Eng),
    baab: getText(r.Baab), kitab: getText(r.Kitab),
    arabic: getText(r.Arabic), ravi: getText(r.Ravi),
    urdu: getText(r.Urdu), english: getText(r.English),
    volume: getText(r.Volume),
  }
}

async function loadPool(): Promise<RandomHadith[]> {
  const db = createQuranClient()
  // Never let a slow/blocked database hang the client for half a minute.
  const rows = (await Promise.race([
    query(db, `SELECT hadees_number, BookUR, Baab_Eng, Kitab_Eng, Baab, Kitab, Arabic, Ravi, Urdu, English, Volume FROM tbl_random_hadees ORDER BY RANDOM() LIMIT ${POOL_SIZE}`),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
  ])) as any[]
  if (!rows.length) throw new Error(NO_HADITH)
  return rows.map(toHadith)
}

/** Rotates per warm instance; the pool refreshes on its TTL. */
let cursor = 0

export async function GET() {
  try {
    const pool = await randomHadithPool.load(loadPool)
    const item = pool[cursor % pool.length]
    cursor = (cursor + 1) % pool.length
    if (!item) throw new Error(NO_HADITH)
    // `no-store` is deliberate: a cached "random" answer would repeat.
    return json(item)
  } catch (e: any) {
    if (e?.message === NO_HADITH) return error('No hadith found')
    return error('Failed to load random hadith')
  }
}
