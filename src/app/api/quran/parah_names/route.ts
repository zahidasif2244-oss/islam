import { json } from '@/lib/api-utils'
import paras from '@/data/static/parah_names.json'

export async function GET() {
  return json(paras, 200, 86400)
}