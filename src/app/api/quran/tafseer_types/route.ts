import { json } from '@/lib/api-utils'
import types from '@/data/static/tafseer_types.json'

export async function GET() {
  return json(types, 200, 86400)
}