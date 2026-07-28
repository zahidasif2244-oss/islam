import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, `
    SELECT surat_id, COUNT(*) as verses, MIN(arabic) as first_verse
    FROM tbl_QuranComplete GROUP BY surat_id ORDER BY surat_id
  `)
  const surahs = rows.map(r => ({ id: r.surat_id, verses: r.verses, opening: (getText(r.first_verse) || '').slice(0, 60) }))
  return json(surahs, 200, 86400)
}
