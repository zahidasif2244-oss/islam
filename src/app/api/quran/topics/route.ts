import { json } from '@/lib/api-utils'
import topics from '@/data/static/topics.json'

export async function GET() {
  return json(topics, 200, 86400)
}