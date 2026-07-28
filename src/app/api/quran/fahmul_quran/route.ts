import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT id, ayat, ayat_ahrab, count, urdu, english FROM faham_quran ORDER BY id')
  const items = rows.map(r => ({
    id: r.id, ayat: getText(r.ayat),
    ayat_ahrab: getText(r.ayat_ahrab) || '',
    count: r.count, urdu: getText(r.urdu), english: getText(r.english)
  }))
  return json(items, 200, 86400)
}
