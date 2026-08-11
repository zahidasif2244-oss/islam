import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@libsql/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = {}
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const db = createClient({ url: env.TURSO_QURAN_DB_URL, authToken: env.TURSO_QURAN_DB_TOKEN })

const TRANSLATIONS = [
  ['translation_saheeh_international', 20],
  ['translation_yusuf_ali', 22],
  ['translation_hilali_khan', 203],
  ['translation_spanish_isa_garcia', 83],
  ['translation_bengali', 161],
  ['translation_tamil', 50],
  ['translation_french', 31],
  ['translation_german', 27],
  ['translation_turkish', 77],
  ['translation_indonesian', 33],
  ['translation_malay', 39],
  ['translation_nepali', 108],
  ['translation_marathi', 226],
  ['translation_telugu', 227],
]

const SURAH_VERSE_COUNT = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]

function verseKeyAt(index) {
  let i = index
  for (let s = 1; s < 115; s++) {
    const n = SURAH_VERSE_COUNT[s]
    if (i < n) return [s, i + 1]
    i -= n
  }
  return null
}

function cleanText(t) {
  return String(t).replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function sqlLiteral(s) {
  return "'" + String(s).replace(/'/g, "''") + "'"
}

async function execRetry(stmts, mode) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { return await db.batch(stmts, mode) } catch (e) {
      if (attempt === 4) throw e
      await new Promise(r => setTimeout(r, 3000 * attempt))
      console.log(`    retry ${attempt} after: ${e.message.slice(0, 50)}`)
    }
  }
}

async function ensureColumn(col) {
  const { rows } = await db.execute(`PRAGMA table_info(tbl_QuranComplete)`)
  if (!rows.some(r => String(r.name) === col)) {
    await db.execute({ sql: `ALTER TABLE tbl_QuranComplete ADD COLUMN "${col}" TEXT DEFAULT null` })
    console.log(`  + created column ${col}`)
  }
}

async function fetchTranslation(id) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://api.quran.com/api/v4/quran/translations/${id}`, { signal: AbortSignal.timeout(120000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (attempt === 4) throw e
      await new Promise(r => setTimeout(r, 3000 * attempt))
    }
  }
}

async function importLang(col, apiId) {
  const { rows: pre } = await db.execute({ sql: `SELECT COUNT(*) c FROM tbl_QuranComplete WHERE "${col}" IS NOT NULL AND "${col}" != ''` })
  if (Number(pre[0].c) >= 6236) { console.log(`\n=== ${col} (api ${apiId}) === SKIPPED (already ${pre[0].c} rows)`); return Number(pre[0].c) }
  console.log(`\n=== ${col} (api ${apiId}) ===`)
  const data = await fetchTranslation(apiId)
  const items = data.translations
  const rows = []
  for (let i = 0; i < items.length; i++) {
    const key = verseKeyAt(i)
    if (key) rows.push([key[0], key[1], cleanText(items[i].text)])
  }
  console.log(`  fetched ${items.length} verses, mapped ${rows.length}`)
  await ensureColumn(col)
  await db.execute('CREATE TABLE IF NOT EXISTS _staging (surat_id INTEGER, ayat_number INTEGER, text TEXT)')
  await db.execute('DELETE FROM _staging')
  const CHUNK = 1500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values = chunk.map(r => `(${r[0]},${r[1]},${sqlLiteral(r[2])})`).join(',')
    await execRetry([{ sql: `INSERT INTO _staging (surat_id, ayat_number, text) VALUES ${values}` }], 'write')
  }
  await execRetry([{ sql: `UPDATE tbl_QuranComplete SET "${col}" = (SELECT s.text FROM _staging s WHERE s.surat_id = tbl_QuranComplete.surat_id AND s.ayat_number = tbl_QuranComplete.ayat_number) WHERE EXISTS (SELECT 1 FROM _staging s2 WHERE s2.surat_id = tbl_QuranComplete.surat_id AND s2.ayat_number = tbl_QuranComplete.ayat_number)` }], 'write')
  const { rows: cnt } = await db.execute({ sql: `SELECT COUNT(*) c FROM tbl_QuranComplete WHERE "${col}" IS NOT NULL AND "${col}" != ''` })
  console.log(`  done: ${cnt[0].c} rows with data`)
  return Number(cnt[0].c)
}

const totals = {}
for (const [col, apiId] of TRANSLATIONS) {
  try {
    totals[col] = await importLang(col, apiId)
  } catch (e) {
    console.log(`  FAILED: ${e.message}`)
    totals[col] = 0
  }
}
console.log('\n=== SUMMARY ===')
for (const [col, n] of Object.entries(totals)) console.log(`${n}\t${col}`)
process.exit(0)