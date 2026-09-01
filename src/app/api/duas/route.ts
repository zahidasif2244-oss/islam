import { json } from '@/lib/api-utils'
import duas from '@/data/static/duas.json'

export const dynamic = 'force-static'

export async function GET() {
  const result = duas.filter((d: any) => d.source === 'tbl_dua')
  return json(result, 200, 86400)
}
