import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS, COL_IS_URDU } from '@/lib/constants'
import { loadSurah } from '@/lib/baked'
import tafseerTypes from '@/data/static/tafseer_types.json'

let allAyahs: any[] | null = null

function loadAllAyahs(): any[] {
  if (allAyahs) return allAyahs
  allAyahs = []
  for (let sid = 1; sid <= 114; sid++) {
    const ayahs = loadSurah(sid)
    if (ayahs) allAyahs!.push(...ayahs)
  }
  return allAyahs!
}

function encodeUrdu(text: string): string {
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

let colCounts: Record<string, number> | null = null

function getColCounts(): Record<string, number> {
  if (colCounts) return colCounts
  colCounts = {}
  for (const t of tafseerTypes) colCounts[t.key] = Number(t.count) || 0
  return colCounts
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const type = url.searchParams.get('type') || ''

  if (!q.trim()) return error('Search query required', 400)

  const ayahs = loadAllAyahs()
  const results: any[] = []

  let colInfo = type
    ? TAFSEER_COLUMNS.filter(([c]) => c === type)
    : TAFSEER_COLUMNS

  if (!type) {
    colInfo = colInfo.filter(([c]) => (getColCounts()[c] || 0) > 0)
  }

  const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
  const phrase = typedWords.join(' ')

  for (const [col, label] of colInfo) {
    const isUrdu = COL_IS_URDU[col] || false
    const words = isUrdu ? typedWords.map(encodeUrdu) : typedWords
    const searchPhrase = isUrdu ? encodeUrdu(phrase) : phrase

    const colResults: any[] = []
    for (const a of ayahs) {
      const text = a[col]
      if (!text) continue

      let matchCount = 0
      let phraseMatch = 0
      for (const w of words) {
        if (text.includes(w)) matchCount++
      }
      if (text.includes(searchPhrase)) phraseMatch = 1
      if (!matchCount) continue

      colResults.push({
        surah: a.surat_id, ayah: a.ayat_number,
        arabic: a.arabic || '',
        tafseer: text,
        tafseer_type: col, tafseer_label: label,
        searchWords: typedWords,
        match_count: matchCount,
        total_words: typedWords.length,
        phrase_match: phraseMatch,
      })
    }
    colResults.sort((a, b) => b.phrase_match - a.phrase_match || b.match_count - a.match_count || a.tafseer.length - b.tafseer.length)
    results.push(...colResults.slice(0, 50))
  }

  return json(results)
}
