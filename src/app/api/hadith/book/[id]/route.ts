import { json, error } from '@/lib/api-utils'
import { BOOK_NAMES } from '@/lib/constants'
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 20
  const offset = (page - 1) * perPage

  const book = loadHadithBook(id)
  if (!book) return error('Book not found')

  const hadiths = book.hadiths.slice(offset, offset + perPage)
  return json({
    hadiths, total: book.total, page, pages: Math.ceil(book.total / perPage),
    name: BOOK_NAMES[id] || id
  }, 200, 86400)
}
