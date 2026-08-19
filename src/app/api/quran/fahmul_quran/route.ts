import { json } from '@/lib/api-utils'
import items from '@/data/static/fahmul_quran.json'

export async function GET() {
  return json(items, 200, 86400)
}