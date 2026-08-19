import { json } from '@/lib/api-utils'
import books from '@/data/static/hadith_books.json'

export async function GET() {
  return json(books, 200, 86400)
}