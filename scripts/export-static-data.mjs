/**
 * Export the immutable content out of `src/data` (which is bundled into every
 * serverless function) into `public/data` (served straight from Vercel's CDN).
 *
 * Why: the API routes that read `src/data` were traced into ~475 MB function
 * bundles, so every cold request had to download a 475 MB archive -> 20-25 s
 * per first hit (some requests never completed at all). Files under `public/`
 * are static assets: zero functions, zero cold start, immutable edge cache.
 *
 * Run automatically before `next build` (see package.json).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src', 'data')
const OUT = path.join(ROOT, 'public', 'data')

// `--if-missing` lets `npm run dev` reuse whatever was generated last time
// instead of rewriting ~100 MB on every dev-server start.
if (process.argv.includes('--if-missing')) {
  const probe = path.join(OUT, 'quran', '2', 'ar.json')
  const mutradifIndex = path.join(OUT, 'static', 'mutradif-index.json')
  const mutradifDetails = path.join(OUT, 'static', 'mutradif-details')
  const derivedOk =
    fs.existsSync(mutradifIndex) &&
    fs.existsSync(mutradifDetails) &&
    fs.readdirSync(mutradifDetails).length > 0
  if (fs.existsSync(probe) && derivedOk) {
    console.log('[static-data] public/data already present — skipping export (run `npm run data:export` to refresh)')
    process.exit(0)
  }
}

/** Translation columns the UI can show (matches src/lib/constants.ts). */
const TRANSLATIONS = [
  'translation_urdu', 'aai', 'tq', 'najfi', 'botvi', 'moudoodi', 'k_iman',
  'translation_mufti_taqi', 'translation_english', 'hindi_nazar',
  'translation_roman_urdu', 'translation_saheeh_international',
  'translation_yusuf_ali', 'translation_hilali_khan',
  'translation_spanish_isa_garcia', 'translation_bengali', 'translation_tamil',
  'translation_french', 'translation_german', 'translation_turkish',
  'translation_indonesian', 'translation_malay', 'translation_nepali',
  'translation_marathi', 'translation_telugu',
]

/** Tafseer columns the UI can show. */
const TAFSEERS = [
  'tafseer_moudoodi', 'taqi_tafseer', 'k_iman', 'tafseer_tibyan',
  'tafseer_fizilal', 'tafseer_karam_shah', 'tafseer_tadabbar_ul_quran',
  'tafseer_ahsan_ul_bayan', 'tafseer_al_burhan_bil_quran',
  'tafseer_wahiduddin_khan', 'tafseer_abdul_salam',
  'tafseer_wahiduddin_khan_english', 'tafseer_tafheem_english',
  'tafseer_zia_ul_quran', 'tafseer_irfan_ul_quran', 'tafseer_ul_hasanaat',
  'tafseer_khazain', 'tafseer_noor', 'tafseer_sirat', 'tafseer_jalalain',
]

const written = { files: 0, bytes: 0 }

function write(rel, data) {
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const json = JSON.stringify(data)
  fs.writeFileSync(file, json)
  written.files++
  written.bytes += json.length
}

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf-8'))
  } catch {
    return null
  }
}

const isFilled = v => typeof v === 'string' && v.length > 0

/* Fail early with a clear message if the committed corpus is missing — a
 * deployment that silently ships an empty /data folder is worse than a
 * failed build. */
if (!fs.existsSync(path.join(SRC, 'quran', 'surah-1.json'))) {
  console.error('[static-data] src/data/quran/surah-*.json is missing — cannot build the static corpus')
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/* Quran: one folder per surah                                         */
/*   {id}/ar.json          { p: para[], y: ayah[], s: surah[], a: arabic[] }
 *   {id}/tr-<column>.json [ text per verse ]                          */
/* ------------------------------------------------------------------ */

function verseArrays(rows) {
  const out = {
    p: [], y: [], s: [], a: [],
  }
  for (const r of rows) {
    out.p.push(r.para_id)
    out.y.push(r.ayat_number)
    out.s.push(r.surat_id)
    out.a.push(r.arabic || '')
  }
  return out
}

/** How many ayahs actually carry text, per column — used to hide empty
 *  languages from the settings dropdowns instead of silently falling back. */
const translationAyahs = {}
const tafseerAyahs = {}

function writeTranslations(rows, prefix, countInto) {
  for (const col of TRANSLATIONS) {
    const values = rows.map(r => (isFilled(r[col]) ? r[col] : ''))
    const filled = values.reduce((n, v) => n + (v ? 1 : 0), 0)
    if (!filled) continue
    if (countInto) translationAyahs[col] = (translationAyahs[col] || 0) + filled
    write(path.join(prefix, `tr-${col}.json`), values)
  }
}

let surahCount = 0
for (let id = 1; id <= 114; id++) {
  const rows = readJson(path.join('quran', `surah-${id}.json`))
  if (!rows || !rows.length) continue
  write(path.join('quran', String(id), 'ar.json'), verseArrays(rows))
  writeTranslations(rows, path.join('quran', String(id)), true)
  surahCount++
}

/* ------------------------------------------------------------------ */
/* Quran: one folder per parah (a parah spans several surahs)          */
/* ------------------------------------------------------------------ */

const parahNames = readJson(path.join('static', 'parah_names.json')) || []
let parahCount = 0
for (const info of parahNames) {
  const rows = []
  for (let sid = info.start_surah; sid <= info.end_surah; sid++) {
    const ayahs = readJson(path.join('quran', `surah-${sid}.json`)) || []
    for (const a of ayahs) {
      if (sid === info.start_surah && a.ayat_number < info.start_ayah) continue
      if (sid === info.end_surah && a.ayat_number > info.end_ayah) continue
      rows.push(a)
    }
  }
  if (!rows.length) continue
  write(path.join('quran', 'parah', String(info.id), 'ar.json'), verseArrays(rows))
  writeTranslations(rows, path.join('quran', 'parah', String(info.id)))
  parahCount++
}

/* ------------------------------------------------------------------ */
/* Quran: tafseer, one file per (surah, column)                        */
/* ------------------------------------------------------------------ */

let tafseerFiles = 0
for (let id = 1; id <= 114; id++) {
  const data = readJson(path.join('quran', `tafseer-${id}.json`))
  if (!data) continue
  for (const col of TAFSEERS) {
    const map = {}
    let filled = 0
    for (const [ayah, cols] of Object.entries(data)) {
      const text = cols && cols[col]
      if (isFilled(text)) {
        map[ayah] = text
        filled++
      }
    }
    if (!filled) continue
    tafseerAyahs[col] = (tafseerAyahs[col] || 0) + filled
    write(path.join('quran', 'tafseer', String(id), `${col}.json`), map)
    tafseerFiles++
  }
}

/* ------------------------------------------------------------------ */
/* Quran: word-by-word + arabic word analysis (per surah)              */
/* ------------------------------------------------------------------ */

for (let id = 1; id <= 114; id++) {
  const wbw = readJson(path.join('quran', `wbw-${id}.json`))
  if (wbw && Object.keys(wbw).length) write(path.join('quran', 'wbw', `${id}.json`), wbw)
  const awords = readJson(path.join('quran', `awords-${id}.json`))
  if (awords && Object.keys(awords).length) write(path.join('quran', 'awords', `${id}.json`), awords)
}

/* ------------------------------------------------------------------ */
/* Static lists (surahs, topics, duas, search index, ...)              */
/* ------------------------------------------------------------------ */

const staticDir = path.join(SRC, 'static')
let staticFiles = 0
for (const file of fs.readdirSync(staticDir)) {
  if (!file.endsWith('.json')) continue
  // mutradif.json (3.9 MB) is only needed when that tab is opened; keep it.
  write(path.join('static', file), JSON.parse(fs.readFileSync(path.join(staticDir, file), 'utf-8')))
  staticFiles++
}

/* Mutradif: compact index + per-id detail shards ----------------------
 * The source list is 3.9 MB raw (~1 MB gzip / 640 KB brotli). Browsing and
 * searching only need the heading plus the short summary, and a full entry
 * is opened one card at a time, so split it in two:
 *
 *   static/mutradif-index.json        ~620 KB raw / ~100 KB brotli
 *   static/mutradif-details/<n>.json  ~82 KB raw / ~22 KB gzip each
 *
 * IDs are NOT sequential (1, 2, 3, 10, ...), so shard by id bucket and look
 * the exact entry up by `id` on the client (see loadMutradifDetail).
 */
const mutradif = readJson(path.join('static', 'mutradif.json'))
if (Array.isArray(mutradif) && mutradif.length) {
  const MUTRADIF_SHARD_SIZE = 64
  const index = mutradif.map(m => ({
    id: m.id,
    heading: m.heading || '',
    word: m.word || '',
    urdu_head: m.urdu_head || '',
    alphabet: m.alphabet || '',
    summary: m.summary || '',
    total_ayat: m.total_ayat || 0,
  }))
  write(path.join('static', 'mutradif-index.json'), index)

  const shards = new Map()
  for (const m of mutradif) {
    const id = Number(m.id)
    if (!Number.isFinite(id) || id < 1) continue
    const key = Math.floor((id - 1) / MUTRADIF_SHARD_SIZE)
    if (!shards.has(key)) shards.set(key, [])
    shards.get(key).push(m)
  }
  for (const [key, rows] of shards) {
    write(path.join('static', 'mutradif-details', `${key}.json`), rows)
  }
}

/* Availability ---------------------------------------------------------
 * translations.json / tafseer_types.json carry a `count` from the database
 * that counts rows, not text: 14 of the 23 translations were never imported
 * and are empty in every ayah. That made the settings dropdown offer languages
 * which silently fell back to Urdu ("I change the tarjma and nothing happens").
 * Replace `count` with the number of ayahs that actually have text (0 = hide).
 */
function writeAvailability(file, counts) {
  const entries = readJson(path.join('static', file)) || []
  const out = entries.map(entry => ({ ...entry, count: counts[entry.key] || 0 }))
  write(path.join('static', file), out)
  return out
}

const translationsOut = writeAvailability('translations.json', translationAyahs)
const tafseerOut = writeAvailability('tafseer_types.json', tafseerAyahs)
const availableTranslations = translationsOut.filter(t => t.count > 0).length
const availableTafseers = tafseerOut.filter(t => t.count > 0).length

/* Books ------------------------------------------------------------- */
const books = readJson('books.json')
if (books) write('books.json', books)

/* Child sites — the folders under public/ that are mini websites ----- */
const PUBLIC_DIR = path.join(ROOT, 'public')
const IGNORED_DIRS = new Set(['fonts', 'data', '_next', 'books'])
const sites = fs
  .readdirSync(PUBLIC_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && !IGNORED_DIRS.has(e.name))
  .map(e => ({
    name: e.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    url: `/${encodeURIComponent(e.name)}/`,
  }))
write(path.join('static', 'sites.json'), sites)

const mb = (written.bytes / 1024 / 1024).toFixed(1)
console.log(`[static-data] surahs=${surahCount} parahs=${parahCount} tafseer=${tafseerFiles} static=${staticFiles}`)
console.log(`[static-data] available: ${availableTranslations}/${translationsOut.length} translations, ${availableTafseers}/${tafseerOut.length} tafseers`)
console.log(`[static-data] wrote ${written.files} files, ${mb} MB into public/data`)
