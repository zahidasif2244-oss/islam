import { json, error } from '@/lib/api-utils'
import fs from 'fs'
import path from 'path'

const hadithCache = new Map<string, any>()

function loadHadithBook(bookId: string): any | null {
  if (hadithCache.has(bookId)) return hadithCache.get(bookId)
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'hadith', `${bookId}.json`), 'utf-8')
    const data = JSON.parse(raw)
    hadithCache.set(bookId, data)
    return data
  } catch { return null }
}

function searchField(text: string, words: string[]): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  let count = 0
  for (const w of words) {
    if (lower.includes(w.toLowerCase())) count++
  }
  return count
}

export async function GET(req: Request, { params }: { params: Promise<{ book: string }> }) {
  const { book } = await params
  const q = new URL(req.url).searchParams.get('q') || ''

  const bookData = loadHadithBook(book)
  if (!bookData) return error('Book not found')

  const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
  if (typedWords.length === 0) return json([])

  const phrase = typedWords.join(' ').toLowerCase()
  const results: any[] = []

  for (const h of bookData.hadiths) {
    const urduCount = searchField(h.urdu, typedWords)
    const englishCount = searchField(h.english, typedWords)
    const arabicCount = searchField(h.arabic, typedWords)
    const raviCount = searchField(h.urdu_ravi, typedWords) + searchField(h.english_ravi, typedWords)
    const totalCount = urduCount + englishCount + arabicCount + raviCount
    if (!totalCount) continue

    const combined = `${h.urdu || ''} ${h.english || ''} ${h.arabic || ''} ${h.urdu_ravi || ''} ${h.english_ravi || ''}`.toLowerCase()
    const phraseMatch = combined.includes(phrase) ? 1 : 0

    results.push({
      number: h.number, international_number: h.international_number,
      arabic: h.arabic, urdu: h.urdu, urdu_ravi: h.urdu_ravi,
      english: h.english, english_ravi: h.english_ravi,
      searchWords: typedWords,
      match_count: totalCount, total_words: typedWords.length,
      phrase_match: phraseMatch,
    })
  }

  results.sort((a, b) => b.phrase_match - a.phrase_match || b.match_count - a.match_count || a.number - b.number)
  return json(results.slice(0, 50), 200, 300)
}
