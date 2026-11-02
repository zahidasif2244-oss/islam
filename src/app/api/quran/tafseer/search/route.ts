import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS } from '@/lib/constants'

/**
 * Tafseer search.
 *
 * The corpus itself lives as static files under /data (one file per surah and
 * tafseer column). This handler pulls them from the CDN on first use and keeps
 * them in memory for the warm instance, instead of carrying an ~90 MB data
 * bundle inside the function — which used to make the first search take 20 s+.
 */

type SurahTafseer = Record<string, string>

let cache: { type: string; data: Map<number, SurahTafseer> } | null = null

async function fetchJson<T>(req: Request, path: string): Promise<T | null> {
  try {
    const res = await fetch(new URL(path, req.url), { cache: 'force-cache' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function loadColumn(req: Request, type: string): Promise<Map<number, SurahTafseer>> {
  if (cache && cache.type === type) return cache.data
  const data = new Map<number, SurahTafseer>()
  // 114 surahs, a handful in flight at a time.
  const ids = Array.from({ length: 114 }, (_, i) => i + 1)
  const CONCURRENCY = 12
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(id => fetchJson<SurahTafseer>(req, `/data/quran/tafseer/${id}/${type}.json`))
    )
    results.forEach((map, index) => {
      if (map) data.set(batch[index], map)
    })
  }
  cache = { type, data }
  return data
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const type = url.searchParams.get('type') || ''
  if (!q.trim()) return error('Search query required', 400)
  if (!type) return error('Tafseer type required', 400)

  const colInfo = TAFSEER_COLUMNS.find(([c]) => c === type)
  if (!colInfo) return error('Unknown tafseer type', 400)
  const label = colInfo[1]

  const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
  const phrase = typedWords.join(' ')

  const corpus = await loadColumn(req, type)
  if (!corpus.size) return json([])

  const hits: any[] = []
  for (const [surahId, ayahs] of corpus) {
    for (const [ayahKey, text] of Object.entries(ayahs)) {
      if (!text) continue
      let matchCount = 0
      for (const w of typedWords) if (text.includes(w)) matchCount++
      if (!matchCount) continue
      hits.push({
        surah: surahId,
        ayah: Number(ayahKey),
        tafseer: text,
        tafseer_type: type,
        tafseer_label: label,
        searchWords: typedWords,
        match_count: matchCount,
        total_words: typedWords.length,
        phrase_match: phrase && text.includes(phrase) ? 1 : 0,
      })
    }
  }

  hits.sort(
    (a, b) =>
      b.phrase_match - a.phrase_match ||
      b.match_count - a.match_count ||
      a.tafseer.length - b.tafseer.length
  )
  const top = hits.slice(0, 50)

  // Attach the Arabic of the matched ayahs (one extra CDN file per surah hit).
  const surahs = [...new Set(top.map(h => h.surah))]
  const arabicBySurah = new Map<number, { a: string[]; y: number[] }>()
  await Promise.all(
    surahs.map(async sid => {
      const ar = await fetchJson<{ a: string[]; y: number[] }>(req, `/data/quran/${sid}/ar.json`)
      if (ar?.a) arabicBySurah.set(sid, ar)
    })
  )
  for (const h of top) {
    const file = arabicBySurah.get(h.surah)
    const idx = file ? file.y.indexOf(h.ayah) : -1
    h.arabic = idx >= 0 ? file!.a[idx] || '' : ''
  }

  return json(top, 200, 3600)
}
