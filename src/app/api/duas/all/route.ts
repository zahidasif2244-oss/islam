import { json } from '@/lib/api-utils'
import duas from '@/data/static/duas.json'

export const dynamic = 'force-static'

export async function GET() {
  return json(duas, 200, 86400)
}
