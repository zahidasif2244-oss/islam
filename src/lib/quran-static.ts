/**
 * Client-side access to the Quran corpus.
 *
 * Everything here reads the immutable files under `public/data` (served from
 * Vercel's CDN with a 1-year immutable cache) instead of calling a serverless
 * function that has to boot a ~475 MB bundle on every cold request.
 *
 * Shapes are identical to the old `/api/quran/*` responses so the UI code only
 * needs to call these helpers instead of `fetch('/api/...')`.
 */
import { quranWords, arabicQuranMatches, encodeUrduPhrase, decodeUrduInline } from './quran-search'
import { normalizeArabicVariants } from './arabic'

const BASE = '/data'

/** De-duplicated, memoised fetch — one network request per file per session. */
const fileCache = new Map<string, Promise<any>>()

export function statJson<T = any>(rel: string): Promise<T> {
  const key = BASE + rel
  let p = fileCache.get(key)
  if (!p) {
    p = fetch(key, { cache: 'force-cache' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
    fileCache.set(key, p)
  }
  return p as Promise<T>
}

export type Verse = {
  id: number
  surah: number
  para: number
  ayah: number
  arabic: string
  arabic_tajweed: string
  urdu: string
  english: string
  roman_urdu: string
  hindi: string
  tarjma_text?: string
}

type ArFile = { p: number[]; y: number[]; s: number[]; a: string[] }

const arCache = new Map<string, Promise<ArFile | null>>()

function loadAr(kind: 'surah' | 'parah', id: number) {
  const key = `${kind}:${id}`
  let p = arCache.get(key)
  if (!p) {
    p = statJson<ArFile>(kind === 'parah' ? `/quran/parah/${id}/ar.json` : `/quran/${id}/ar.json`)
    arCache.set(key, p)
  }
  return p
}

function loadTr(kind: 'surah' | 'parah', id: number, col: string): Promise<string[] | null> {
  const base = kind === 'parah' ? `/quran/parah/${id}` : `/quran/${id}`
  return statJson<string[]>(`${base}/tr-${col}.json`)
}

/** Whole surah / parah, with the selected translation resolved to `tarjma_text`. */
export async function getVerses(kind: 'surah' | 'parah', id: number, tarjma = 'k_iman'): Promise<Verse[]> {
  const [ar, tr] = await Promise.all([loadAr(kind, id), loadTr(kind, id, tarjma)])
  if (!ar) return []
  // Columns that were never imported have no file: fall back to the canonical
  // Urdu translation instead of showing an empty line.
  let fallback: string[] | null = null
  if (!tr && tarjma !== 'translation_urdu') fallback = await loadTr(kind, id, 'translation_urdu')
  const out: Verse[] = []
  const n = ar.a.length
  for (let i = 0; i < n; i++) {
    const surah = Number(ar.s[i])
    const ayah = Number(ar.y[i])
    const tarjmaText = (tr && tr[i]) || (fallback && fallback[i]) || ''
    out.push({
      id: surah * 1000 + ayah,
      surah,
      para: Number(ar.p[i]),
      ayah,
      arabic: ar.a[i] || '',
      arabic_tajweed: '',
      urdu: tarjmaText,
      english: '',
      roman_urdu: '',
      hindi: '',
      tarjma_text: tarjmaText,
    })
  }
  return out
}

/** A single ayah range (search results, topics, subjects…). */
export async function getAyahs(surah: number, start: number, end?: number): Promise<Verse[]> {
  const last = end === undefined ? start : end
  const [ar, urdu, english] = await Promise.all([
    loadAr('surah', surah),
    loadTr('surah', surah, 'translation_urdu'),
    loadTr('surah', surah, 'translation_english'),
  ])
  if (!ar) return []
  const out: Verse[] = []
  for (let i = 0; i < ar.y.length; i++) {
    const ayah = Number(ar.y[i])
    if (ayah < start || ayah > last) continue
    out.push({
      id: surah * 1000 + ayah,
      surah,
      para: Number(ar.p[i]),
      ayah,
      arabic: ar.a[i] || '',
      arabic_tajweed: '',
      urdu: urdu?.[i] || '',
      english: english?.[i] || '',
      roman_urdu: '',
      hindi: '',
    })
  }
  return out
}

/** Whole-surah tafseer for one column: `{ "1": "text", … }` keyed by ayah. */
export async function getSurahTafseer(surah: number, col: string): Promise<Record<string, string>> {
  const data = await statJson<Record<string, string>>(`/quran/tafseer/${surah}/${col}.json`)
  return data || {}
}

/** All tafseer columns for one ayah — only the requested column is downloaded. */
export async function getAyahTafseer(surah: number, ayah: number, col: string): Promise<Record<string, string>> {
  const map = await getSurahTafseer(surah, col)
  return { [col]: map[String(ayah)] || '' }
}

export async function getWbw(surah: number, ayah: number) {
  const data = await statJson<Record<string, any[]>>(`/quran/wbw/${surah}.json`)
  const words = (data && data[ayah]) || []
  return {
    arabic: words.map((w: any) => w.arabic || ''),
    urdu: words.map((w: any) => w.urdu || ''),
    english: words.map((w: any) => w.english || ''),
    hindi: words.map((w: any) => w.hindi || ''),
  }
}

export async function getArabicWords(surah: number, ayah: number) {
  const data = await statJson<Record<string, any[]>>(`/quran/awords/${surah}.json`)
  return (data && data[ayah]) || []
}

/* ------------------------------------------------------------------ */
/* Search — runs in the browser over the pre-normalised static index.  */
/* ------------------------------------------------------------------ */

let indexPromise: Promise<any[]> | null = null

export function prefetchSearchIndex() {
  if (!indexPromise) {
    indexPromise = statJson<any[]>('/static/search-index.json').then(x => x || [])
  }
  return indexPromise
}

export async function searchQuranText(q: string, lang: 'urdu' | 'arabic' = 'urdu') {
  const index = await prefetchSearchIndex()
  const { typedWords, phrase, words } = quranWords(q)
  if (!words.length || !index.length) return []
  if (lang === 'arabic') {
    const normPhrases = normalizeArabicVariants(phrase).map(v => v.text).filter(Boolean)
    const hits = arabicQuranMatches(index, words, normPhrases)
    return hits.slice(0, 100).map(r => ({
      id: r.id, surah: r.surah, ayah: r.ayah,
      arabic: r.arabic, urdu: decodeUrduInline(r.urdu || ''),
      english: r.english, roman_urdu: r.roman_urdu,
      searchWords: typedWords,
      match_count: r.count,
      total_words: typedWords.length,
      phrase_match: r.arabicPhrase,
    }))
  }

  const phraseEnc = encodeUrduPhrase(phrase)
  const rows: any[] = []
  for (const r of index) {
    const urduFlags = words.map(w => (r.urE && r.urE.includes(w.enc) ? 1 : 0))
    const count = urduFlags.reduce((a: number, b: number) => a + b, 0)
    if (!count) continue
    rows.push({
      id: r.id, surah: r.s, ayah: r.a,
      arabic: r.ar, urdu: decodeUrduInline(r.ur || ''),
      english: r.en, roman_urdu: r.ro,
      urduFlags,
      urduPhrase: r.urE && r.urE.includes(phraseEnc) ? 1 : 0,
    })
  }

  return rows.slice(0, 100).map(r => ({
    id: r.id, surah: r.surah, ayah: r.ayah,
    arabic: r.arabic, urdu: r.urdu, english: r.english, roman_urdu: r.roman_urdu,
    searchWords: typedWords,
    match_count: r.urduFlags.reduce((a: number, b: number) => a + b, 0),
    total_words: typedWords.length,
    phrase_match: r.urduPhrase,
  }))
}

/* ------------------------------------------------------------------ */
/* Books — baked list from the CDN, admin edits applied when available */
/* ------------------------------------------------------------------ */

const bookKey = (b: any) => String(b?.bakedKey || b?.url || b?.cover || '').trim().toLowerCase()

type BookOverrides = { custom: any[]; hidden: string[] } | null

let overridesPromise: Promise<BookOverrides> | null = null

/** Admin edits live in Turso; they are optional and must never block the grid. */
function loadOverrides(): Promise<BookOverrides> {
  if (!overridesPromise) {
    overridesPromise = Promise.race([
      fetch('/api/books/overrides', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]) as Promise<BookOverrides>
  }
  return overridesPromise
}

export async function getBooks(): Promise<any[]> {
  // 1. The catalogue itself — a static, edge-cached file.
  const baked = await statJson<any[]>('/books.json')
  const list: any[] = Array.isArray(baked) ? baked : []
  if (!list.length) return []

  // 2. Optional admin overlay — at most 450 ms, otherwise show the baked list.
  const overrides = await Promise.race([
    loadOverrides(),
    new Promise<BookOverrides>(resolve => setTimeout(() => resolve(null), 450)),
  ]).catch(() => null)

  const custom: any[] = overrides?.custom || []
  const hidden: string[] = overrides?.hidden || []
  if (!custom.length && !hidden.length) {
    return list.map(b => ({ ...b, source: b.source || 'Dawaateislami' }))
  }

  const hiddenSet = new Set(hidden.map(k => String(k).toLowerCase()))
  const customByKey = new Map<string, any>()
  for (const c of custom) {
    const k = bookKey(c)
    if (k) customByKey.set(k, c)
  }

  const out: any[] = []
  const seen = new Set<string>()
  for (const b of list) {
    const k = bookKey(b)
    if (k && hiddenSet.has(k)) continue
    if (k && seen.has(k)) continue
    if (k) seen.add(k)
    const override = k ? customByKey.get(k) : undefined
    out.push(override ? { ...override, source: 'Custom' } : { ...b, source: b.source || 'Dawaateislami' })
  }
  for (const c of custom) {
    const k = bookKey(c)
    if (k && seen.has(k)) continue
    if (k) seen.add(k)
    out.push({ ...c, source: 'Custom' })
  }
  return out
}
