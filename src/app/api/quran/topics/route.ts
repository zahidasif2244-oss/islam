import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT topic_id, surat_id, surat_name, start_ayat_id, end_ayat_id, urdu_topics, eng_topics, para_id FROM tbl_QuranTopics ORDER BY surat_id, start_ayat_id')
  const topics = rows.map(r => ({
    id: r.topic_id, surah: r.surat_id, surah_name: getText(r.surat_name),
    start_ayah: r.start_ayat_id, end_ayah: r.end_ayat_id,
    urdu: getText(r.urdu_topics), english: getText(r.eng_topics), para: r.para_id
  }))
  return json(topics, 200, 86400)
}
