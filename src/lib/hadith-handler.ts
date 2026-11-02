import { json, error } from '@/lib/api-utils'
import { BOOK_NAMES } from '@/lib/constants'

export type HadithBook = { total: number; name?: string; hadiths: any[] }

/**
 * One handler shared by the 17 per-book routes under /api/hadith/<book>.
 *
 * Each route file loads exactly one book, so a cold start only pulls ~4-44 MB
 * instead of the 320 MB "all books" bundle that every hadith endpoint used to
 * carry (that bundle was the reason the first Hadith request took 20 s+).
 *
 *   ?action=page&page=1        → one page of hadiths (20 per page)
 *   ?action=number&q=12        → search by hadith number
 *   ?action=search&q=...       → word search across the book
 *   ?action=one&number=12      → a single hadith
 */
export async function handleHadith(req: Request, bookId: string, load: () => HadithBook | null) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'page'
  const book = load()
  if (!book) return error('Book not found')

  if (action === 'one') {
    const num = parseInt(url.searchParams.get('number') || '0')
    const h = book.hadiths.find((x: any) => x.number === num)
    if (!h) return error('Hadith not found')
    return json(h, 200, 86400)
  }

  if (action === 'number') {
    const qn = (url.searchParams.get('q') || '').trim()
    if (!qn) return json([])
    const results: any[] = []
    for (const h of book.hadiths) {
      const numStr = String(h.number || '')
      const intlStr = String(h.international_number || '')
      if (numStr.includes(qn) || intlStr.includes(qn)) {
        results.push({
          number: h.number,
          international_number: h.international_number,
          arabic: h.arabic,
          urdu: h.urdu,
          english: h.english,
        })
      }
    }
    results.sort((a, b) => {
      const rank = (n: any) => (String(n) === qn ? 0 : String(n).startsWith(qn) ? 1 : 2)
      return rank(a.number) - rank(b.number) || a.number - b.number
    })
    return json(results.slice(0, 30), 200, 300)
  }

  if (action === 'search') {
    const q = url.searchParams.get('q') || ''
    const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
    if (typedWords.length === 0) return json([])

    const searchField = (text: string) => {
      if (!text) return 0
      const lower = text.toLowerCase()
      let count = 0
      for (const w of typedWords) if (lower.includes(w.toLowerCase())) count++
      return count
    }

    const phrase = typedWords.join(' ').toLowerCase()
    const results: any[] = []
    for (const h of book.hadiths) {
      const total =
        searchField(h.urdu) + searchField(h.english) + searchField(h.arabic) +
        searchField(h.urdu_ravi) + searchField(h.english_ravi)
      if (!total) continue
      const combined = `${h.urdu || ''} ${h.english || ''} ${h.arabic || ''} ${h.urdu_ravi || ''} ${h.english_ravi || ''}`.toLowerCase()
      results.push({
        number: h.number,
        international_number: h.international_number,
        arabic: h.arabic,
        urdu: h.urdu,
        urdu_ravi: h.urdu_ravi,
        english: h.english,
        english_ravi: h.english_ravi,
        searchWords: typedWords,
        match_count: total,
        total_words: typedWords.length,
        phrase_match: combined.includes(phrase) ? 1 : 0,
      })
    }
    results.sort(
      (a, b) => b.phrase_match - a.phrase_match || b.match_count - a.match_count || a.number - b.number
    )
    return json(results.slice(0, 50), 200, 300)
  }

  // default: one page of the book
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 20
  const offset = (page - 1) * perPage
  return json(
    {
      hadiths: book.hadiths.slice(offset, offset + perPage),
      total: book.total,
      page,
      pages: Math.ceil(book.total / perPage),
      name: BOOK_NAMES[bookId] || bookId,
    },
    200,
    86400
  )
}
