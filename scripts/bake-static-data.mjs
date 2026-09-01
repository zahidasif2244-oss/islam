import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'static')
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets')
const LOCAL_QURAN_DB = process.env.LOCAL_QURAN_DB || path.join(ASSETS_DIR, 'quranDb.db')
const LOCAL_HADITH_DIR = process.env.LOCAL_HADITH_DIR || path.join(ASSETS_DIR, 'databases')

const PARAH_NAMES = ['', 'الم', 'سيقول', 'تلك الرسل',
  'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا',
  'ولو أننا', 'قال الملأ', 'واعلموا', 'يعتذرون',
  'وما من دابة', 'وما أبرئ', 'ربما', 'سبحان الذي',
  'قد أفلح', 'والذين يدعون', 'قد أفلح', 'وقال الذين',
  'أمن خلق', 'اتل ما أوحي', 'ومن يقنت', 'وما لي',
  'فمن أظلم', 'إليه يرد', 'حم', 'قال فما', 'قد سمع',
  'تبارك', 'عم'
]

const TRANSLATION_COLUMNS = [
  ['translation_urdu', 'Muhammad Juna Garhi', true],
  ['aai', 'Amin Ahsan Islahi', true],
  ['tq', 'Tahir-ul-Qadri', true],
  ['najfi', 'Muhammad Hussain Najfi', true],
  ['botvi', 'Noor ul Amin', true],
  ['moudoodi', 'Abul Aalaa Moudoodi', true],
  ['k_iman', 'Kanzul Eman', true],
  ['translation_mufti_taqi', 'Mufti Taqi Usmani', true],
  ['translation_english', 'English', false],
  ['hindi_nazar', 'Hindi', false],
  ['translation_roman_urdu', 'Roman Urdu', false],
  ['translation_saheeh_international', 'English (Saheeh International)', false],
  ['translation_yusuf_ali', 'English (Yusuf Ali)', false],
  ['translation_hilali_khan', 'English (Hilali & Khan)', false],
  ['translation_spanish_isa_garcia', 'Spanish (Isa Garcia)', false],
  ['translation_bengali', 'Bengali', false],
  ['translation_tamil', 'Tamil', false],
  ['translation_french', 'French', false],
  ['translation_german', 'German', false],
  ['translation_turkish', 'Turkish', false],
  ['translation_indonesian', 'Indonesian', false],
  ['translation_malay', 'Malay', false],
  ['translation_nepali', 'Nepali', false],
  ['translation_marathi', 'Marathi', false],
  ['translation_telugu', 'Telugu', false],
]

const TAFSEER_COLUMNS = [
  ['tafseer_moudoodi', 'Tafseer Moudoodi', true],
  ['taqi_tafseer', 'Taqi Tafseer (Usmani)', true],
  ['k_iman', 'Kanzul Iman', true],
  ['tafseer_tibyan', 'Tibyan ul Quran', false],
  ['tafseer_fizilal', 'Tafseer Fizilal', true],
  ['tafseer_karam_shah', 'Tafseer Karam Shah', true],
  ['tafseer_tadabbar_ul_quran', 'Tadabbar ul Quran', true],
  ['tafseer_ahsan_ul_bayan', 'Ahsan ul Bayan', true],
  ['tafseer_al_burhan_bil_quran', 'Al Burhan bil Quran', true],
  ['tafseer_wahiduddin_khan', 'Wahiduddin Khan', true],
  ['tafseer_abdul_salam', 'Abdul Salam', true],
  ['tafseer_wahiduddin_khan_english', 'Wahiduddin (Eng)', false],
  ['tafseer_tafheem_english', 'Tafheem (Eng)', false],
  ['tafseer_zia_ul_quran', 'Zia ul Quran', false],
  ['tafseer_irfan_ul_quran', 'Irfan ul Quran', false],
  ['tafseer_ul_hasanaat', 'Tafseer ul Hasanaat', false],
  ['tafseer_khazain', 'Khazain ul Irfan', false],
  ['tafseer_noor', 'Noor ul Irfan', false],
  ['tafseer_sirat', 'Sirat ul Jinan', false],
  ['tafseer_jalalain', 'Tafseer-e-Jalalain', false],
]

const BOOK_NAMES = {
  bukhari: 'Sahih Bukhari', muslim: 'Sahih Muslim',
  abu_dawood: 'Sunan Abu Dawood', tirmazi: 'Jami Tirmizi',
  nasai: 'Sunan Nasai', maja: 'Sunan Ibn Maja',
  musnad: 'Musnad Ahmad', mishkat: 'Mishkat al-Masabih',
  silsila: 'Silsila Sahiha',
  shaybah: 'Musannaf Ibn Abi Shaybah',
  muwatta: 'Muwatta Imam Malik',
  mustadrak: 'Mustadrak al-Hakim',
  khuzaymah: 'Sahih Ibn Khuzaymah',
  hibbaan: 'Sahih Ibn Hibban',
  darmi: 'Sunan al-Darmi',
  beyhaqi: 'Sunan al-Bayhaqi',
  alzawaid: 'Majma al-Zawaid'
}

function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function getText(val) {
  if (val === null || val === undefined) return ''
  if (val instanceof Uint8Array) return new TextDecoder('utf-8').decode(val)
  return String(val)
}

function tryLoad(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'))
  } catch {
    return null
  }
}

function write(file, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(data))
  console.log(`${file}: ${data.length} items, ${(fs.statSync(path.join(OUT_DIR, file)).size / 1024 / 1024).toFixed(2)} MB`)
}

let sqlPromise = null

async function initSql() {
  if (!sqlPromise) sqlPromise = import('sql.js').then(m => m.default({ locateFile: f => path.join('node_modules', 'sql.js', 'dist', f) }))
  return sqlPromise
}

async function openLocal(file) {
  if (!file || !fs.existsSync(file)) return null
  const SQL = await initSql()
  return {
    query: async (sql) => {
      const db = new SQL.Database(fs.readFileSync(file))
      try {
        const res = db.exec(sql)
        if (!res.length) return []
        const { columns, values } = res[0]
        return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]])))
      } finally {
        db.close()
      }
    },
  }
}

async function openTurso(url, token) {
  if (!url || !token) return null
  const { createClient } = await import('@libsql/client')
  const client = createClient({ url, authToken: token })
  return {
    query: async (sql) => {
      try {
        return (await client.execute(sql)).rows
      } finally {
        await client.close()
      }
    },
  }
}

async function quranSource() {
  const local = await openLocal(LOCAL_QURAN_DB)
  if (local) {
    console.log('Quran source: local file')
    return local
  }
  const turso = await openTurso(process.env.TURSO_QURAN_DB_URL, process.env.TURSO_QURAN_DB_TOKEN)
  if (turso) {
    console.log('Quran source: Turso')
    return turso
  }
  console.warn('No quran data source available (local DB or Turso env vars)')
  return null
}

async function bakeQuran() {
  const src = await quranSource()
  if (!src) return false

  const existing = {
    surahs: tryLoad('surahs.json'),
    parah_names: tryLoad('parah_names.json'),
    translations: tryLoad('translations.json'),
    tafseer_types: tryLoad('tafseer_types.json'),
    topics: tryLoad('topics.json'),
    amazing_topics: tryLoad('amazing_topics.json'),
    mutradif: tryLoad('mutradif.json'),
    subjects_english: tryLoad('subjects_english.json'),
    subjects_urdu: tryLoad('subjects_urdu.json'),
    fahmul_quran: tryLoad('fahmul_quran.json'),
  }

  const ok = { ...existing }

  try {
    const surahs = await src.query(`
      SELECT surat_id, COUNT(*) as verses, MIN(arabic) as first_verse
      FROM tbl_QuranComplete GROUP BY surat_id ORDER BY surat_id
    `)
    ok.surahs = surahs.map(r => ({
      id: r.surat_id, verses: r.verses, opening: (getText(r.first_verse) || '').slice(0, 60)
    }))
  } catch (e) { console.warn('surahs failed:', e.message) }

  try {
    const paras = await src.query(`
      SELECT para_id, MIN(surat_id) as ss, MIN(ayat_number) as sa, MAX(surat_id) as es, MAX(ayat_number) as ea
      FROM tbl_QuranComplete WHERE para_id BETWEEN 1 AND 30 GROUP BY para_id ORDER BY para_id
    `)
    ok.parah_names = paras.map(r => ({
      id: r.para_id, arabic_name: PARAH_NAMES[r.para_id] || '',
      start_surah: r.ss, start_ayah: r.sa, end_surah: r.es, end_ayah: r.ea
    }))
  } catch (e) { console.warn('parah_names failed:', e.message) }

  async function colCounts(columns) {
    const out = []
    for (const [col, label, isUrdu] of columns) {
      const rows = await src.query(`SELECT COUNT(*) as cnt FROM tbl_QuranComplete WHERE "${col}" IS NOT NULL AND "${col}" != ''`)
      if (rows.length && Number(rows[0].cnt) > 0) out.push({ key: col, label, is_urdu: isUrdu, count: Number(rows[0].cnt) })
    }
    return out
  }

  try { ok.translations = await colCounts(TRANSLATION_COLUMNS) } catch (e) { console.warn('translations failed:', e.message) }
  try { ok.tafseer_types = await colCounts(TAFSEER_COLUMNS) } catch (e) { console.warn('tafseer_types failed:', e.message) }

  try {
    const topics = await src.query('SELECT topic_id, surat_id, surat_name, start_ayat_id, end_ayat_id, urdu_topics, eng_topics, para_id FROM tbl_QuranTopics ORDER BY surat_id, start_ayat_id')
    ok.topics = topics.map(r => ({
      id: r.topic_id, surah: r.surat_id, surah_name: getText(r.surat_name),
      start_ayah: r.start_ayat_id, end_ayah: r.end_ayat_id,
      urdu: getText(r.urdu_topics), english: getText(r.eng_topics), para: r.para_id
    }))
  } catch (e) { console.warn('topics failed:', e.message) }

  try {
    const amazing = await src.query('SELECT topic_id, surat_id, ayat_number, urdu, english FROM tbl_amazing_topics ORDER BY surat_id, ayat_number')
    ok.amazing_topics = amazing.map(r => ({
      id: r.topic_id, surah: r.surat_id, ayah: r.ayat_number,
      urdu: getText(r.urdu), english: getText(r.english)
    }))
  } catch (e) { console.warn('amazing_topics failed:', e.message) }

  try {
    const mutradif = await src.query('SELECT id, mutradif_id, alphabet, heading, word, details, summary, urdu_head_word, arabic_without_aerab, ayaat, total_ayat FROM tbl_urdu_mutradif ORDER BY alphabet, heading')
    ok.mutradif = mutradif.map(r => ({
      id: r.id, mutradif_id: r.mutradif_id, alphabet: getText(r.alphabet),
      heading: getText(r.heading), word: getText(r.word),
      details: getText(r.details), summary: getText(r.summary),
      urdu_head: getText(r.urdu_head_word), arabic: getText(r.arabic_without_aerab),
      ayaat: getText(r.ayaat), total_ayat: r.total_ayat
    }))
  } catch (e) { console.warn('mutradif failed:', e.message) }

  try {
    const subjects = await src.query('SELECT ID, Letter, English_Word, Reference, Surat_id, Aayat_no FROM EnglishSubjects ORDER BY English_Word LIMIT 1000')
    ok.subjects_english = subjects.map(r => ({
      id: getText(r.ID), letter: getText(r.Letter), word: getText(r.English_Word),
      reference: getText(r.Reference), surah: getText(r.Surat_id), ayah: getText(r.Aayat_no)
    }))
  } catch (e) { console.warn('subjects_english failed:', e.message) }

  try {
    const subjectsUrdu = await src.query('SELECT Surat_and_Aayat_ID, Aayat_no, Surat_Name, Surat_ID, Topic FROM UrduSubjects3 ORDER BY Topic LIMIT 1000')
    ok.subjects_urdu = subjectsUrdu.map(r => ({
      id: getText(r.Surat_and_Aayat_ID), ayah: getText(r.Aayat_no),
      surah_name: getText(r.Surat_Name), surah: getText(r.Surat_ID),
      topic: getText(r.Topic)
    }))
  } catch (e) { console.warn('subjects_urdu failed:', e.message) }

  try {
    const fahmul = await src.query('SELECT id, ayat, ayat_ahrab, count, urdu, english FROM faham_quran ORDER BY id')
    ok.fahmul_quran = fahmul.map(r => ({
      id: r.id, ayat: getText(r.ayat),
      ayat_ahrab: getText(r.ayat_ahrab) || '',
      count: r.count, urdu: getText(r.urdu), english: getText(r.english)
    }))
  } catch (e) { console.warn('fahmul_quran failed:', e.message) }

  let wrote = 0
  for (const [file, data] of Object.entries(ok)) {
    if (data === null) continue
    write(`${file}.json`, data)
    wrote++
  }
  return wrote > 0
}

const DUA_TABLES = [
  ['tbl_dua', 'Duas'],
  ['tbl_dua_Urdu', 'More Duas'],
  ['tbl_prayer', 'Prayers'],
  ['tbl_namaz_e_janaza', 'Janaza'],
  ['tbl_roza', 'Roza'],
]

async function bakeDuas() {
  const src = await quranSource()
  if (!src) return

  const allDuas = []
  for (const [table, label] of DUA_TABLES) {
    try {
      const rows = await src.query(`SELECT dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref FROM ${table} ORDER BY dua_seq`)
      for (const r of rows) {
        allDuas.push({
          id: r.dua_ID, title: getText(r.dua_title), seq: r.dua_seq,
          desc: getText(r.dua_desc), arabic: getText(r.dua_arabic),
          urdu: getText(r.dua_urdu), english: getText(r.dua_eng),
          ref: getText(r.dua_ref), source: table
        })
      }
      console.log(`  ${table} (${label}): ${rows.length} rows`)
    } catch (e) { console.warn(`  ${table} failed:`, e.message) }
  }
  write('duas.json', allDuas)
  console.log(`Duas total: ${allDuas.length} items`)
}

async function bakeHadithBooks() {
  const old = tryLoad('hadith_books.json') || []
  const map = new Map(old.map(b => [b.id, b]))
  let fresh = 0

  for (const [key, name] of Object.entries(BOOK_NAMES)) {
    let count = null
    const local = await openLocal(path.join(LOCAL_HADITH_DIR, `${key}.db`))
    if (local) {
      try {
        const rows = await local.query('SELECT COUNT(*) as cnt FROM hadees')
        count = rows.length ? Number(rows[0].cnt) : null
      } catch (e) { console.warn(`hadith ${key} local failed:`, e.message) }
    } else {
      const turso = await openTurso(
        process.env[`TURSO_HADITH_${key.toUpperCase()}_DB_URL`],
        process.env[`TURSO_HADITH_${key.toUpperCase()}_DB_TOKEN`]
      )
      if (turso) {
        try {
          const rows = await turso.query('SELECT COUNT(*) as cnt FROM hadees')
          count = rows.length ? Number(rows[0].cnt) : null
        } catch (e) { console.warn(`hadith ${key} turso failed:`, e.message) }
      }
    }
    if (count !== null) {
      map.set(key, { id: key, name, count })
      fresh++
    }
  }

  const out = Object.keys(BOOK_NAMES).map(id => map.get(id)).filter(Boolean)
  write('hadith_books.json', out)
  console.log(`Hadith books: ${fresh} refreshed from source`)
}

loadEnv()
const quranOk = await bakeQuran()
await bakeHadithBooks()
await bakeDuas()
if (!quranOk) {
  console.warn('No quran static data produced — routes will fail to build if JSON files are missing')
  process.exit(1)
}