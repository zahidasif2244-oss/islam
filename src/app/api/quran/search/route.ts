import { createQuranClient, query, getText, cleanUrdu } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') || ''
  const db = createQuranClient()
  const match = q.match(/^(\d+):(\d+)$/)
  let rows
  if (match) {
    rows = await query(db, `
      SELECT id, surat_id, ayat_number, arabic, translation_urdu, translation_english, translation_roman_urdu
      FROM tbl_QuranComplete WHERE surat_id = ? AND ayat_number = ? LIMIT 1
    `, [parseInt(match[1]), parseInt(match[2])])
  } else {
    const pattern = `%${q}%`
    rows = await query(db, `
      SELECT id, surat_id, ayat_number, arabic, translation_urdu, translation_english, translation_roman_urdu
      FROM tbl_QuranComplete WHERE translation_urdu LIKE ? OR translation_english LIKE ? OR arabic LIKE ? LIMIT 50
    `, [pattern, pattern, pattern])
  }
  const results = rows.map(r => ({
    id: r.id, surah: r.surat_id, ayah: r.ayat_number,
    arabic: getText(r.arabic), urdu: cleanUrdu(r.translation_urdu, r.translation_roman_urdu),
    english: getText(r.translation_english), roman_urdu: getText(r.translation_roman_urdu)
  }))
  return json(results)
}
