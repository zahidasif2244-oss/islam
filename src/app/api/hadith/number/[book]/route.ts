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

export async function GET(req: Request, { params }: { params: Promise<{ book: string }> }) {
  const { book } = await params
  const q = new URL(req.url).searchParams.get('q') || ''
  const qn = q.trim()

  if (!qn) return json([])

  const bookData = loadHadithBook(book)
  if (!bookData) return error('Book not found')

  const results: any[] = []
  for (const h of bookData.hadiths) {
    const numStr = String(h.number || '')
    const intlStr = String(h.international_number || '')
    if (numStr.includes(qn) || intlStr.includes(qn)) {
      results.push({
        number: h.number, international_number: h.international_number,
        arabic: h.arabic, urdu: h.urdu, english: h.english,
      })
    }
  }

  results.sort((a, b) => {
    const aExact = String(a.number) === qn ? 0 : String(a.number).startsWith(qn) ? 1 : 2
    const bExact = String(b.number) === qn ? 0 : String(b.number).startsWith(qn) ? 1 : 2
    return aExact - bExact || a.number - b.number
  })

  return json(results.slice(0, 30), 200, 300)
}
