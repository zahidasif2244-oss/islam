import { createQuranClient } from '@/lib/db'
import { normalizeArabicVariants } from '@/lib/arabic'
import { json, error } from '@/lib/api-utils'
import { quranWords, urduQuranMatches, arabicQuranMatches, getArabicIndex, encodeUrduPhrase } from '@/lib/quran-search'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const lang = url.searchParams.get('lang') || 'urdu'
  if (!q.trim()) return error('Search query required', 400)

  const db = createQuranClient()
  const { typedWords, phrase, words } = quranWords(q)
  if (words.length === 0) return json([])

  if (lang === 'arabic') {
    const index = await getArabicIndex(db)
    const rows = arabicQuranMatches(index, words, normalizeArabicVariants(phrase).map(v => v.text).filter(Boolean))
    return json(rows.slice(0, 100).map(r => ({
      id: r.id, surah: r.surah, ayah: r.ayah,
      arabic: r.arabic, urdu: r.urdu, english: r.english, roman_urdu: r.roman_urdu,
      searchWords: typedWords,
      match_count: r.count,
      total_words: typedWords.length,
      phrase_match: r.arabicPhrase,
    })))
  }

  const urduRows = await urduQuranMatches(db, words, encodeUrduPhrase(phrase))
  return json(urduRows.slice(0, 100).map(r => ({
    id: r.id, surah: r.surah, ayah: r.ayah,
    arabic: r.arabic, urdu: r.urdu, english: r.english, roman_urdu: r.roman_urdu,
    searchWords: typedWords,
    match_count: r.urduFlags.reduce((a: number, b: number) => a + b, 0),
    total_words: typedWords.length,
    phrase_match: r.urduPhrase,
  })))
}
