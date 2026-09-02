import { json, error } from '@/lib/api-utils'
import { COL_IS_URDU } from '@/lib/constants'
import { loadSurah } from '@/lib/baked'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const surahId = parseInt(id)
  const url = new URL(req.url)
  const tarjma = url.searchParams.get('tarjma') || 'translation_urdu'
  const tafseer = url.searchParams.get('tafseer') || ''

  const ayahs = loadSurah(surahId)
  if (!ayahs) return error('Surah not found')

  const needsTarjma = tarjma && !['translation_urdu', 'translation_english', 'translation_roman_urdu'].includes(tarjma)
  const needsTafseer = !!tafseer

  const verses: any[] = []
  for (const a of ayahs) {
    const v: any = {
      id: a.id, surah: a.surat_id, para: a.para_id, ayah: a.ayat_number,
      arabic: a.arabic || '', arabic_tajweed: a.arabic_tajweed || '',
      urdu: a.translation_urdu || '',
      english: a.translation_english || '', roman_urdu: a.translation_roman_urdu || '',
      hindi: a.hindi_nazar || '',
    }
    if (needsTarjma && a[tarjma]) {
      v.tarjma_text = COL_IS_URDU[tarjma] ? a[tarjma] : String(a[tarjma])
    }
    if (needsTafseer && a[tafseer]) {
      v.tafseer_text = COL_IS_URDU[tafseer] ? a[tafseer] : String(a[tafseer])
    }
    verses.push(v)
  }
  return json(verses, 200, 86400)
}
