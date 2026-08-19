import { json } from '@/lib/api-utils'
import surahs from '@/data/static/surahs.json'

export async function GET() {
  return json(surahs, 200, 86400)
}