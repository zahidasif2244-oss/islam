import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS } from '@/lib/constants'

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

export async function GET(req: Request, { params }: { params: Promise<{ surah: string; ayah: string }> }) {
  const { surah, ayah } = await params
  const surahId = parseInt(surah)
  const ayahId = parseInt(ayah)

  const ayahs = loadSurah(surahId)
  if (!ayahs) return error('Ayah not found')

  const ayahData = ayahs.find(a => a.ayat_number === ayahId)
  if (!ayahData) return error('Ayah not found')

  const result: Record<string, string> = {}
  for (const [col] of TAFSEER_COLUMNS) {
    result[col] = ayahData[col] || ''
  }
  return json(result, 200, 86400)
}
