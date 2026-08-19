import { json } from '@/lib/api-utils'
import items from '@/data/static/mutradif.json'

export async function GET() {
  return json(items, 200, 86400)
}