import { createQuranClient, query, getText, cleanUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = url.searchParams.get('surah')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  if (!surah || !start) return error('surah and start required', 400)

  const db = createQuranClient()
  let rows
  if (end && end !== start) {
    rows = await query(db, `
      SELECT id, surat_id, ayat_number, arabic, arabic_tajweed,
             translation_urdu, translation_english, translation_roman_urdu, translation_mufti_taqi
      FROM tbl_QuranComplete WHERE surat_id = ? AND ayat_number >= ? AND ayat_number <= ? ORDER BY ayat_number
    `, [parseInt(surah), parseInt(start), parseInt(end)])
  } else {
    rows = await query(db, `
      SELECT id, surat_id, ayat_number, arabic, arabic_tajweed,
             translation_urdu, translation_english, translation_roman_urdu, translation_mufti_taqi
      FROM tbl_QuranComplete WHERE surat_id = ? AND ayat_number = ? ORDER BY ayat_number
    `, [parseInt(surah), parseInt(start)])
  }

  const verses = rows.map(r => ({
    id: r.id, surah: r.surat_id, ayah: r.ayat_number,
    arabic: getText(r.arabic), arabic_tajweed: getText(r.arabic_tajweed),
    urdu: cleanUrdu(r.translation_urdu, r.translation_roman_urdu),
    english: getText(r.translation_english), roman_urdu: getText(r.translation_roman_urdu),
    mufti_taqi: getText(r.translation_mufti_taqi)
  }))
  return json(verses)
}
