import { createQuranClient, query, getText, cleanUrdu } from '@/lib/db'
import { json, error, getColumnText } from '@/lib/api-utils'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const surahId = parseInt(id)
  const url = new URL(req.url)
  const tarjma = url.searchParams.get('tarjma') || 'translation_urdu'
  const tafseer = url.searchParams.get('tafseer') || ''

  const db = createQuranClient()
  const rows = await query(db, `
    SELECT id, surat_id, para_id, ayat_number,
           arabic, arabic_tajweed,
           translation_urdu, translation_english, translation_roman_urdu, translation_mufti_taqi,
           hindi_nazar
    FROM tbl_QuranComplete WHERE surat_id = ? ORDER BY ayat_number
  `, [surahId])

  const needsTarjma = tarjma && !['translation_urdu', 'translation_english', 'translation_roman_urdu'].includes(tarjma)
  const needsTafseer = !!tafseer

  let tarjmaMap: Map<number, any> = new Map()
  let tafseerMap: Map<number, any> = new Map()

  if (needsTarjma) {
    const tRows = await query(db, `SELECT id, "${tarjma}" FROM tbl_QuranComplete WHERE surat_id = ? ORDER BY ayat_number`, [surahId])
    for (const tr of tRows) tarjmaMap.set(tr.id as number, tr)
  }
  if (needsTafseer) {
    const tRows = await query(db, `SELECT id, "${tafseer}" FROM tbl_QuranComplete WHERE surat_id = ? ORDER BY ayat_number`, [surahId])
    for (const tr of tRows) tafseerMap.set(tr.id as number, tr)
  }

  const verses: any[] = []
  for (const r of rows) {
    const urduText = getText(r.translation_urdu)
    const romanText = getText(r.translation_roman_urdu)
    const v: any = {
      id: r.id, surah: r.surat_id, para: r.para_id, ayah: r.ayat_number,
      arabic: getText(r.arabic), arabic_tajweed: getText(r.arabic_tajweed),
      urdu: cleanUrdu(urduText, romanText),
      english: getText(r.translation_english), roman_urdu: romanText,
      hindi: getText(r.hindi_nazar)
    }
    if (needsTarjma) {
      const tv = tarjmaMap.get(r.id as number)
      if (tv?.[tarjma]) v.tarjma_text = getColumnText(tarjma, tv[tarjma])
    }
    if (needsTafseer) {
      const tv = tafseerMap.get(r.id as number)
      if (tv?.[tafseer]) v.tafseer_text = getColumnText(tafseer, tv[tafseer])
    }
    verses.push(v)
  }
  return json(verses, 200, 300)
}
