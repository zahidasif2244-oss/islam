import { json } from '@/lib/api-utils'
import items from '@/data/static/subjects_urdu.json'

export async function GET() {
  return json(items, 200, 86400)
}