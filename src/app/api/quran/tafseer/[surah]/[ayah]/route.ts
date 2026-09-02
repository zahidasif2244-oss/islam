import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS } from '@/lib/constants'
import { loadTafseer } from '@/lib/baked'

export async function GET(req: Request, { params }: { params: Promise<{ surah: string; ayah: string }> }) {
  const { surah, ayah } = await params
  const surahId = parseInt(surah)
  const ayahId = parseInt(ayah)

  const tafseerData = loadTafseer(surahId)
  if (!tafseerData) return error('Tafseer not found')

  const ayahTafseer = tafseerData[ayahId]
  if (!ayahTafseer) return error('Ayah not found')

  const result: Record<string, string> = {}
  for (const [col] of TAFSEER_COLUMNS) {
    result[col] = ayahTafseer[col] || ''
  }
  return json(result, 200, 86400)
}
