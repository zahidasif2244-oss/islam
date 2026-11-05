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
import { duaRowKey, normalizeDuaTitles } from './dua-titles'
import { mergeTopicOverrides, type TopicKind } from './topic-merge'

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
  // Arabic + the selected translation are shown by default; translation_urdu is
  // the fallback for verses an edition does not cover (e.g. the basmalah row of
  // the imported 6,236-ayah translations). English and Hindi are toolbar
  // toggles, so they come along in the same round trip.
  const [ar, urdu, tr, english, hindi] = await Promise.all([
    loadAr(kind, id),
    loadTr(kind, id, 'translation_urdu'),
    tarjma === 'translation_urdu' ? Promise.resolve(null) : loadTr(kind, id, tarjma),
    loadTr(kind, id, 'translation_english'),
    loadTr(kind, id, 'hindi_nazar'),
  ])
  if (!ar) return []
  const out: Verse[] = []
  const n = ar.a.length
  for (let i = 0; i < n; i++) {
    const surah = Number(ar.s[i])
    const ayah = Number(ar.y[i])
    const urduText = (urdu && urdu[i]) || ''
    const tarjmaText = (tr && tr[i]) || urduText
    out.push({
      id: surah * 1000 + ayah,
      surah,
      para: Number(ar.p[i]),
      ayah,
      arabic: ar.a[i] || '',
      arabic_tajweed: '',
      urdu: urduText,
      english: english?.[i] || '',
      roman_urdu: '',
      hindi: hindi?.[i] || '',
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
/* Duas — baked list from the CDN, admin edits applied when available  */
/* ------------------------------------------------------------------ */

const DUA_SOURCE_ORDER = ['tbl_dua', 'tbl_dua_Urdu', 'tbl_prayer', 'tbl_namaz_e_janaza', 'tbl_roza']

function duaSourceRank(source: unknown): number {
  const i = DUA_SOURCE_ORDER.indexOf(String(source || ''))
  return i === -1 ? DUA_SOURCE_ORDER.length : i
}

/** Keep the baked order (category, then dua_seq), but apply edited sequences. */
function sortDuaRows(rows: any[]): any[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const bySource = duaSourceRank(a.row?.source) - duaSourceRank(b.row?.source)
      if (bySource) return bySource
      const bySeq = Number(a.row?.seq ?? 0) - Number(b.row?.seq ?? 0)
      if (bySeq) return bySeq
      return a.index - b.index
    })
    .map(x => x.row)
}

function applyDuaOverride(base: any | null, override: any): any {
  const out = { ...(base || {}) }
  const source = override.source || override.table || override.table_name
  if (source) out.source = String(source)
  if (override.id !== undefined && override.id !== null) out.id = Number(override.id)
  if (override.seq !== undefined && override.seq !== null) out.seq = Number(override.seq)
  for (const field of ['title', 'desc', 'arabic', 'urdu', 'english', 'ref'] as const) {
    if (override[field] !== undefined && override[field] !== null) {
      out[field] = String(override[field])
    }
  }
  return out
}

type DuaOverrides = any[] | null

let duaOverridesPromise: Promise<DuaOverrides> | null = null

/**
 * Admin edits live in Turso; they are optional and must never block the tab.
 * The static list paints first, then this small delta arrives and is merged.
 */
function loadDuaOverrides(): Promise<DuaOverrides> {
  if (!duaOverridesPromise) {
    duaOverridesPromise = Promise.race([
      fetch('/api/duas/overrides', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]).then((data: any) => (Array.isArray(data?.rows) ? data.rows : null)) as Promise<DuaOverrides>
  }
  return duaOverridesPromise
}

/** Start the tiny overlay request before the Duas tab is opened. */
export function prefetchDuaOverrides(): void {
  loadDuaOverrides().catch(() => {})
}

/** The baked list, with every title normalised to Urdu. */
export async function getDuaBase(): Promise<any[]> {
  const baked = await statJson<any[]>('/static/duas.json')
  const list = Array.isArray(baked) ? baked : []
  return normalizeDuaTitles(list)
}

export async function getDuaOverrides(): Promise<any[]> {
  const rows = await loadDuaOverrides()
  return rows || []
}

/** Apply admin edits/tombstones/new rows to the baked list. */
export function mergeDuaOverrides(base: any[], overrides: any[]): any[] {
  const list = Array.isArray(base) ? base : []
  const rows = Array.isArray(overrides) ? overrides : []
  if (!rows.length) {
    return sortDuaRows(normalizeDuaTitles(list))
  }

  const byKey = new Map<string, any>()
  for (const override of rows) {
    const key = duaRowKey(override)
    if (key) byKey.set(key, override)
  }

  const out: any[] = []
  const seen = new Set<string>()

  for (const row of list) {
    const key = duaRowKey(row)
    if (key) seen.add(key)
    const override = key ? byKey.get(key) : null
    if (override?.deleted) continue
    const merged = override ? applyDuaOverride(row, override) : { ...row }
    out.push({ ...merged, key: key || duaRowKey(merged) })
  }

  for (const override of rows) {
    if (override?.deleted) continue
    const key = duaRowKey(override)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ ...applyDuaOverride(null, override), key })
  }

  return sortDuaRows(normalizeDuaTitles(out))
}

/* ------------------------------------------------------------------ */
/* Topics — baked lists from the CDN, admin edits applied when available */
/* ------------------------------------------------------------------ */

type TopicOverrides = any[] | null

let topicOverridesPromise: Promise<TopicOverrides> | null = null

/** Admin topic edits live in Turso; they are optional and must not block the tab. */
function loadTopicOverrides(): Promise<TopicOverrides> {
  if (!topicOverridesPromise) {
    topicOverridesPromise = Promise.race([
      fetch('/api/topics/overrides', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]).then((data: any) => (Array.isArray(data?.rows) ? data.rows : null)) as Promise<TopicOverrides>
  }
  return topicOverridesPromise
}

/** Start the tiny overlay request before the Topics tab is opened. */
export function prefetchTopicOverrides(): void {
  loadTopicOverrides().catch(() => {})
}

export async function getTopicBase(kind: TopicKind): Promise<any[]> {
  const baked = await statJson<any[]>(kind === 'topics' ? '/static/topics.json' : '/static/amazing_topics.json')
  return Array.isArray(baked) ? baked : []
}

export async function getTopicOverrides(): Promise<any[]> {
  const rows = await loadTopicOverrides()
  return rows || []
}

/** Merged convenience helpers; the tab itself paints the base list first. */
export async function getTopics(): Promise<any[]> {
  const [base, overrides] = await Promise.all([getTopicBase('topics'), getTopicOverrides()])
  return mergeTopicOverrides(base, overrides, 'topics')
}

export async function getAmazingTopics(): Promise<any[]> {
  const [base, overrides] = await Promise.all([getTopicBase('amazing'), getTopicOverrides()])
  return mergeTopicOverrides(base, overrides, 'amazing')
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

/** Start the (tiny, optional) overlay request before the Books tab is opened. */
export function prefetchBookOverrides(): void {
  loadOverrides().catch(() => {})
}

export async function getBooks(): Promise<any[]> {
  // 1. The catalogue itself — a static, edge-cached file.
  // 2. Optional admin overlay — at most 450 ms, otherwise show the baked list.
  // Both start together so the overlay does not add latency on top of the file.
  const [baked, overrides] = await Promise.all([
    statJson<any[]>('/books.json'),
    Promise.race([
      loadOverrides(),
      new Promise<BookOverrides>(resolve => setTimeout(() => resolve(null), 450)),
    ]).catch(() => null),
  ])

  const list: any[] = Array.isArray(baked) ? baked : []
  if (!list.length) return []

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
