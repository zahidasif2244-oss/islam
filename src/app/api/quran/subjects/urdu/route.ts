import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT Surat_and_Aayat_ID, Aayat_no, Surat_Name, Surat_ID, Topic FROM UrduSubjects3 ORDER BY Topic LIMIT 1000')
  const items = rows.map(r => ({
    id: getText(r.Surat_and_Aayat_ID), ayah: getText(r.Aayat_no),
    surah_name: getText(r.Surat_Name), surah: getText(r.Surat_ID),
    topic: getText(r.Topic)
  }))
  return json(items, 200, 86400)
}
