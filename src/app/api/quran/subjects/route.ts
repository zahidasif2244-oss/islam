import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT ID, Letter, English_Word, Reference, Surat_id, Aayat_no FROM EnglishSubjects ORDER BY English_Word LIMIT 1000')
  const items = rows.map(r => ({
    id: getText(r.ID), letter: getText(r.Letter), word: getText(r.English_Word),
    reference: getText(r.Reference), surah: getText(r.Surat_id), ayah: getText(r.Aayat_no)
  }))
  return json(items, 200, 86400)
}
