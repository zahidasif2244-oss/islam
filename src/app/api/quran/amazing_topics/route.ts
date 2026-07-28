import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT topic_id, surat_id, ayat_number, urdu, english FROM tbl_amazing_topics ORDER BY surat_id, ayat_number')
  const topics = rows.map(r => ({
    id: r.topic_id, surah: r.surat_id, ayah: r.ayat_number,
    urdu: getText(r.urdu), english: getText(r.english)
  }))
  return json(topics, 200, 86400)
}
