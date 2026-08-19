import { json } from '@/lib/api-utils'
import types from '@/data/static/translations.json'

export async function GET() {
  return json(types, 200, 86400)
}