import { createHadithClient, query } from '@/lib/db'
import { json } from '@/lib/api-utils'
import { BOOK_NAMES } from '@/lib/constants'

let cachedBooks: any[] | null = null

export async function GET() {
  if (cachedBooks) return json(cachedBooks, 200, 86400)
  const results = await Promise.allSettled(
    Object.entries(BOOK_NAMES).map(async ([key, name]) => {
      const db = createHadithClient(key)
      const [{ cnt }] = await query(db, 'SELECT COUNT(*) as cnt FROM hadees')
      return { id: key, name, count: Number(cnt) }
    })
  )
  cachedBooks = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value)
  return json(cachedBooks, 200, 86400)
}
