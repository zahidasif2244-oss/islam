import { createClient } from '@libsql/client'
import type { Client } from '@libsql/client'
import { BOOK_NAMES } from './constants'

function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

const QURAN_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_quran_surat_ayah ON tbl_QuranComplete(surat_id, ayat_number)',
  'CREATE INDEX IF NOT EXISTS idx_quran_para ON tbl_QuranComplete(para_id)',
  'CREATE INDEX IF NOT EXISTS idx_arabic_words_surat_ayah ON tbl_arabic_words(arabic_surat_id, arabic_ayat_number)',
  // Admin dua edits read one topic group (dua_ID) and delete by dua_ID/dua_seq.
  'CREATE INDEX IF NOT EXISTS idx_dua_id_seq ON tbl_dua(dua_ID, dua_seq)',
  'CREATE INDEX IF NOT EXISTS idx_dua_urdu_id_seq ON tbl_dua_Urdu(dua_ID, dua_seq)',
  'CREATE INDEX IF NOT EXISTS idx_prayer_id_seq ON tbl_prayer(dua_ID, dua_seq)',
  'CREATE INDEX IF NOT EXISTS idx_namaz_e_janaza_id_seq ON tbl_namaz_e_janaza(dua_ID, dua_seq)',
  'CREATE INDEX IF NOT EXISTS idx_roza_id_seq ON tbl_roza(dua_ID, dua_seq)',
]

const HADITH_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_hadees_number ON hadees(hadees_number)',
  'CREATE INDEX IF NOT EXISTS idx_hadees_lang_rec ON hadees_languages(hadees_record_id, language_id)',
]

/**
 * Index bootstrap.
 *
 * The indexes below were created once on every database (scripts/create-indexes.mjs)
 * and are idempotent, but running 90 DDL statements against 18 databases on
 * every cold start burns write quota and delays the first request. It is now
 * opt-in: set ENSURE_INDEXES=1 after pointing the app at a brand-new database.
 */
let indexPromise: Promise<void> | null = null

export function ensureIndexes(): Promise<void> {
  if (process.env.ENSURE_INDEXES !== '1') return Promise.resolve()
  if (!indexPromise) {
    indexPromise = (async () => {
      const runIndexes = async (client: Client, sqls: string[]) => {
        for (const sql of sqls) {
          try {
            await client.execute(sql)
          } catch {}
        }
      }
      try {
        await runIndexes(getQuranClient(), QURAN_INDEX_SQL)
      } catch {}
      for (const key of Object.keys(BOOK_NAMES)) {
        try {
          await runIndexes(getHadithClient(key), HADITH_INDEX_SQL)
        } catch {}
      }
    })().catch(() => {})
  }
  return indexPromise
}

const quranClientCache = new Map<string, Client>()

/** Raw client getter; used by the index bootstrap so it cannot re-enter itself. */
function getQuranClient(): Client {
  const key = 'quran'
  let c = quranClientCache.get(key)
  if (!c) {
    c = createClient({ url: getEnv('TURSO_QURAN_DB_URL'), authToken: getEnv('TURSO_QURAN_DB_TOKEN') })
    quranClientCache.set(key, c)
  }
  return c
}

export function createQuranClient(): Client {
  ensureIndexes()
  return getQuranClient()
}

const hadithClientCache = new Map<string, Client>()

/** Raw client getter; used by the index bootstrap so it cannot re-enter itself. */
function getHadithClient(bookId: string): Client {
  const key = `TURSO_HADITH_${bookId.toUpperCase()}_DB_URL`
  let c = hadithClientCache.get(key)
  if (!c) {
    const tokenKey = `TURSO_HADITH_${bookId.toUpperCase()}_DB_TOKEN`
    c = createClient({ url: getEnv(key), authToken: getEnv(tokenKey) })
    hadithClientCache.set(key, c)
  }
  return c
}

export function createHadithClient(bookId: string): Client {
  ensureIndexes()
  return getHadithClient(bookId)
}

export async function query(client: Client, sql: string, args?: any[]): Promise<Record<string, any>[]> {
  const result = await client.execute({ sql, args })
  return result.rows
}

export async function queryOne(client: Client, sql: string, args?: any[]): Promise<Record<string, any> | null> {
  const rows = await query(client, sql, args)
  return rows[0] || null
}

export async function run(client: Client, sql: string, args?: any[]): Promise<void> {
  await client.execute({ sql, args })
}

export function getText(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Uint8Array) return new TextDecoder('utf-8').decode(val)
  return String(val)
}

export function decodeUrdu(encrypted: unknown): string {
  const text = getText(encrypted)
  if (!text) return ''
  let result = ''
  for (const c of text) {
    const cp = c.charCodeAt(0)
    if (cp === 0x0623 || cp === 13 || cp === 10) { result += ' '; continue }
    if (cp === 0x00AE || cp === 0x00BE) continue
    if (cp >= 33 && cp <= 126) { result += c; continue }
    if (cp >= 0x600 && cp <= 0x6FF) {
      let newCp = cp - 3
      if (newCp < 0x600) newCp = 0x6FF - (0x600 - newCp) + 1
      result += String.fromCharCode(newCp)
    }
  }
  return result.replace(/\?d\s*\S+@\S+/g, '').replace(/\?2dA/g, '').replace(/\r/g, ' ').replace(/ +/g, ' ').trim()
}

export function cleanUrdu(urduText: unknown, romanText: unknown): string {
  const decoded = decodeUrdu(urduText)
  if (decoded) return decoded
  const roman = getText(romanText)
  if (roman) return roman
  return getText(urduText)
}
