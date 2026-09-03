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

export async function GET(req: Request, { params }: { params: Promise<{ book: string; number: string }> }) {
  const { book, number } = await params
  const hadithNum = parseInt(number)

  const bookData = loadHadithBook(book)
  if (!bookData) return error('Book not found')

  const h = bookData.hadiths.find((h: any) => h.number === hadithNum)
  if (!h) return error('Hadith not found')

  return json(h, 200, 86400)
}
