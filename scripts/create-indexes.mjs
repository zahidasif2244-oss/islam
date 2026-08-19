import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BOOK_KEYS = [
  'bukhari', 'muslim', 'abu_dawood', 'tirmazi', 'nasai', 'maja',
  'musnad', 'mishkat', 'silsila', 'shaybah', 'muwatta', 'mustadrak',
  'khuzaymah', 'hibbaan', 'darmi', 'beyhaqi', 'alzawaid'
]

const QURAN_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_quran_surat_ayah ON tbl_QuranComplete(surat_id, ayat_number)',
  'CREATE INDEX IF NOT EXISTS idx_quran_para ON tbl_QuranComplete(para_id)',
  'CREATE INDEX IF NOT EXISTS idx_arabic_words_surat_ayah ON tbl_arabic_words(arabic_surat_id, arabic_ayat_number)',
]

const HADITH_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_hadees_number ON hadees(hadees_number)',
  'CREATE INDEX IF NOT EXISTS idx_hadees_lang_rec ON hadees_languages(hadees_record_id, language_id)',
]

function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnv()

const { createClient } = await import('@libsql/client')

async function apply(db, sqls) {
  const done = []
  const failed = []
  for (const sql of sqls) {
    try {
      await db.execute(sql)
      done.push(sql.match(/idx_\w+/)?.[0] || 'index')
    } catch (e) {
      failed.push(`${sql.match(/idx_\w+/)?.[0] || 'index'}: ${e.message}`)
    }
  }
  return { done, failed }
}

const quranUrl = process.env.TURSO_QURAN_DB_URL
const quranToken = process.env.TURSO_QURAN_DB_TOKEN
if (quranUrl && quranToken) {
  const db = createClient({ url: quranUrl, authToken: quranToken })
  const r = await apply(db, QURAN_INDEX_SQL)
  console.log('quran: ok =', r.done.join(', '), r.failed.length ? `| failed = ${r.failed.join('; ')}` : '')
  await db.close()
} else {
  console.warn('TURSO_QURAN_DB_URL/TOKEN missing — skipped quran indexes')
}

let okCount = 0
let failCount = 0
for (const key of BOOK_KEYS) {
  const url = process.env[`TURSO_HADITH_${key.toUpperCase()}_DB_URL`]
  const token = process.env[`TURSO_HADITH_${key.toUpperCase()}_DB_TOKEN`]
  if (!url || !token) {
    console.warn(`hadith ${key}: env missing — skipped`)
    continue
  }
  const db = createClient({ url, authToken: token })
  const r = await apply(db, HADITH_INDEX_SQL)
  const status = r.failed.length ? `failed = ${r.failed.join('; ')}` : 'ok'
  console.log(`hadith ${key}: ${status}`)
  if (r.failed.length) failCount++
  else okCount++
  await db.close()
}

console.log(`Done. hadith dbs indexed: ${okCount}, with failures: ${failCount}`)