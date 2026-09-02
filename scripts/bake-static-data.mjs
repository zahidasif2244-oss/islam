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

const QURAN_OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'quran')

function writeQuran(file, data) {
  fs.mkdirSync(QURAN_OUT_DIR, { recursive: true })
  const filePath = path.join(QURAN_OUT_DIR, file)
  fs.writeFileSync(filePath, JSON.stringify(data))
  const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2)
  console.log(`  quran/${file}: ${size} MB`)
}

function decodeUrduText(encrypted) {
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

function encodeUrduText(text) {
  let result = ''
  for (const c of text) {
    const cp = c.charCodeAt(0)
    if (cp >= 0x600 && cp <= 0x6FF) {
      let newCp = cp + 3
      if (newCp > 0x6FF) newCp = 0x600 + (newCp - 0x6FF - 1)
      result += String.fromCharCode(newCp)
    } else result += c
  }
  return result
}

function parseWbw(text) {
  return getText(text).split('@').map(p => {
    const idx = p.indexOf('&')
    return idx >= 0 ? p.slice(idx + 1).trim() : p.trim()
  }).filter(Boolean)
}

const SURAH_COLUMNS = [
  'id', 'surat_id', 'para_id', 'ayat_number',
  'arabic', 'arabic_tajweed',
  'translation_urdu', 'translation_english', 'translation_roman_urdu', 'translation_mufti_taqi',
  'hindi_nazar',
  'aai', 'tq', 'najfi', 'botvi', 'moudoodi', 'k_iman',
  'translation_saheeh_international', 'translation_yusuf_ali', 'translation_hilali_khan',
  'translation_spanish_isa_garcia', 'translation_bengali', 'translation_tamil',
  'translation_french', 'translation_german', 'translation_turkish',
  'translation_indonesian', 'translation_malay', 'translation_nepali',
  'translation_marathi', 'translation_telugu',
  'tafseer_moudoodi', 'taqi_tafseer', 'k_iman',
  'tafseer_tibyan', 'tafseer_fizilal', 'tafseer_karam_shah',
  'tafseer_tadabbar_ul_quran', 'tafseer_ahsan_ul_bayan',
  'tafseer_al_burhan_bil_quran', 'tafseer_wahiduddin_khan', 'tafseer_abdul_salam',
  'tafseer_wahiduddin_khan_english', 'tafseer_tafheem_english',
  'tafseer_zia_ul_quran', 'tafseer_irfan_ul_quran', 'tafseer_ul_hasanaat',
  'tafseer_khazain', 'tafseer_noor', 'tafseer_sirat', 'tafseer_jalalain',
]

const URDU_COLS = new Set([
  'translation_urdu', 'aai', 'tq', 'najfi', 'botvi', 'moudoodi', 'k_iman',
  'translation_mufti_taqi', 'hindi_nazar',
  'tafseer_moudoodi', 'taqi_tafseer', 'tafseer_fizilal', 'tafseer_karam_shah',
  'tafseer_tadabbar_ul_quran', 'tafseer_ahsan_ul_bayan',
  'tafseer_al_burhan_bil_quran', 'tafseer_wahiduddin_khan', 'tafseer_abdul_salam',
])

async function bakeSurahs() {
  const src = await quranSource()
  if (!src) return false
  console.log('Baking surahs...')

  const cols = SURAH_COLUMNS.map(c => `"${c}"`).join(', ')
  const rows = await src.query(`SELECT ${cols} FROM tbl_QuranComplete ORDER BY surat_id, ayat_number`)

  const bySurah = new Map()
  for (const r of rows) {
    const sid = r.surat_id
    if (!bySurah.has(sid)) bySurah.set(sid, [])
    const ayah = { n: r.ayat_number }
    for (const c of SURAH_COLUMNS) {
      if (c === 'surat_id' || c === 'ayat_number') continue
      const val = r[c]
      if (val === null || val === undefined) { ayah[c] = ''; continue }
      if (URDU_COLS.has(c)) {
        ayah[c] = decodeUrduText(val)
      } else {
        ayah[c] = getText(val)
      }
    }
    bySurah.get(sid).push(ayah)
  }

  let totalSize = 0
  for (const [sid, ayahs] of bySurah) {
    writeQuran(`surah-${sid}.json`, ayahs)
    totalSize += fs.statSync(path.join(QURAN_OUT_DIR, `surah-${sid}.json`)).size
  }
  console.log(`Surahs: ${bySurah.size} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB total`)
  return true
}

async function bakeWordByWord() {
  const src = await quranSource()
  if (!src) return false
  console.log('Baking word-by-word...')

  const [wbwUrdu, wbwEng, wbwHindi, arabicWords] = await Promise.all([
    src.query('SELECT surat_id, ayat_number, translation FROM tbl_word_by_word_new ORDER BY surat_id, ayat_number, id'),
    src.query('SELECT surat_id, ayat_number, translation FROM word_by_word_english ORDER BY surat_id, ayat_number, id'),
    src.query('SELECT surat_id, ayat_number, translation FROM word_by_word_hindi ORDER BY surat_id, ayat_number, id'),
    src.query('SELECT arabic_surat_id, arabic_ayat_number, arabic_word FROM tbl_arabic_words ORDER BY arabic_surat_id, arabic_ayat_number, word_id'),
  ])

  const urduMap = new Map()
  for (const r of wbwUrdu) {
    const key = `${r.surat_id}:${r.ayat_number}`
    if (!urduMap.has(key)) urduMap.set(key, [])
    urduMap.get(key).push(parseWbw(r.translation))
  }

  const engMap = new Map()
  for (const r of wbwEng) {
    const key = `${r.surat_id}:${r.ayat_number}`
    if (!engMap.has(key)) engMap.set(key, [])
    engMap.get(key).push(parseWbw(r.translation))
  }

  const hindiMap = new Map()
  for (const r of wbwHindi) {
    const key = `${r.surat_id}:${r.ayat_number}`
    if (!hindiMap.has(key)) hindiMap.set(key, [])
    hindiMap.get(key).push(parseWbw(r.translation))
  }

  const arMap = new Map()
  for (const r of arabicWords) {
    const key = `${r.arabic_surat_id}:${r.arabic_ayat_number}`
    if (!arMap.has(key)) arMap.set(key, [])
    arMap.get(key).push(getText(r.arabic_word).trim())
  }

  const allKeys = new Set([...urduMap.keys(), ...engMap.keys(), ...hindiMap.keys(), ...arMap.keys()])
  const bySurah = new Map()
  for (const key of allKeys) {
    const [sid, ayah] = key.split(':').map(Number)
    if (!bySurah.has(sid)) bySurah.set(sid, {})
    const urdu = urduMap.get(key) || []
    const eng = engMap.get(key) || []
    const hindi = hindiMap.get(key) || []
    const arabic = arMap.get(key) || []
    const maxLen = Math.max(urdu.length, eng.length, hindi.length, arabic.length)
    const words = []
    for (let i = 0; i < maxLen; i++) {
      words.push({
        arabic: arabic[i] || '',
        urdu: (urdu[i] || []).join(' '),
        english: (eng[i] || []).join(' '),
        hindi: (hindi[i] || []).join(' '),
      })
    }
    bySurah.get(sid)[ayah] = words
  }

  let totalSize = 0
  for (const [sid, ayahs] of bySurah) {
    writeQuran(`wbw-${sid}.json`, ayahs)
    totalSize += fs.statSync(path.join(QURAN_OUT_DIR, `wbw-${sid}.json`)).size
  }
  console.log(`Word-by-word: ${bySurah.size} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB total`)
  return true
}

async function bakeArabicWords() {
  const src = await quranSource()
  if (!src) return false
  console.log('Baking arabic words...')

  const rows = await src.query(`
    SELECT arabic_surat_id, arabic_ayat_number, arabic_word, meaning, english_meaning,
           urdu_meaning, root, word_id, arabic_without_aeraab_arabic
    FROM tbl_arabic_words ORDER BY arabic_surat_id, arabic_ayat_number, word_id
  `)

  const bySurah = new Map()
  for (const r of rows) {
    const sid = r.arabic_surat_id
    const ayah = r.arabic_ayat_number
    if (!bySurah.has(sid)) bySurah.set(sid, {})
    if (!bySurah.get(sid)[ayah]) bySurah.get(sid)[ayah] = []
    bySurah.get(sid)[ayah].push({
      word: getText(r.arabic_word),
      meaning: getText(r.meaning),
      english: getText(r.english_meaning),
      urdu: getText(r.urdu_meaning),
      root: getText(r.root),
      word_id: r.word_id,
      without_aeraab: getText(r.arabic_without_aeraab_arabic),
    })
  }

  let totalSize = 0
  for (const [sid, ayahs] of bySurah) {
    writeQuran(`awords-${sid}.json`, ayahs)
    totalSize += fs.statSync(path.join(QURAN_OUT_DIR, `awords-${sid}.json`)).size
  }
  console.log(`Arabic words: ${bySurah.size} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB total`)
  return true
}

async function bakeSearchIndex() {
  const src = await quranSource()
  if (!src) return false
  console.log('Baking search index...')

  const rows = await src.query(`
    SELECT id, surat_id, ayat_number, arabic, translation_urdu, translation_english, translation_roman_urdu
    FROM tbl_QuranComplete ORDER BY surat_id, ayat_number
  `)

  function normalizeArabic(text) {
    return text
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0621]/g, '')
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      .replace(/\u0629/g, '\u0647')
      .replace(/[\u0649\u064A]/g, '\u064A')
      .replace(/\u0643/g, '\u0643')
      .replace(/\u0647/g, '\u0647')
      .replace(/\u0624/g, '\u0648')
  }

  const index = rows.map(r => {
    const arabic = getText(r.arabic)
    const urduRaw = getText(r.translation_urdu)
    return {
      id: r.id, s: r.surat_id, a: r.ayat_number,
      ar: arabic,
      ur: urduRaw,
      en: getText(r.translation_english),
      ro: getText(r.translation_roman_urdu),
      arN: normalizeArabic(arabic),
      urE: encodeUrduText(decodeUrduText(urduRaw)),
    }
  })

  write('search-index.json', index)
  console.log(`Search index: ${index.length} ayahs`)
  return true
}

loadEnv()
const quranOk = await bakeQuran()
await bakeHadithBooks()
await bakeDuas()
await bakeSurahs()
await bakeWordByWord()
await bakeArabicWords()
await bakeSearchIndex()
if (!quranOk) {
  console.warn('No quran static data produced — routes will fail to build if JSON files are missing')
  process.exit(1)
}