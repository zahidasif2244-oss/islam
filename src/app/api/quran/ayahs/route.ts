import { json, error } from '@/lib/api-utils'

const surahCache = new Map<number, any[]>()

function loadSurah(id: number): any[] | null {
  if (surahCache.has(id)) return surahCache.get(id)!
  try {
    const data = require(`@/data/quran/surah-${id}.json`)
    surahCache.set(id, data)
    return data
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = url.searchParams.get('surah')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  if (!surah || !start) return error('surah and start required', 400)

  const surahId = parseInt(surah)
  const startAyah = parseInt(start)
  const endAyah = end ? parseInt(end) : startAyah

  const ayahs = loadSurah(surahId)
  if (!ayahs) return error('Surah not found')

  const filtered = ayahs
    .filter(a => a.ayat_number >= startAyah && a.ayat_number <= endAyah)
    .map(a => ({
      id: a.id, surah: a.surat_id, ayah: a.ayat_number,
      arabic: a.arabic || '', arabic_tajweed: a.arabic_tajweed || '',
      urdu: a.translation_urdu || '',
      english: a.translation_english || '', roman_urdu: a.translation_roman_urdu || '',
      mufti_taqi: a.translation_mufti_taqi || '',
    }))

  return json(filtered, 200, 86400)
}
