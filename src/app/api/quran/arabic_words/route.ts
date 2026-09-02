import { json } from '@/lib/api-utils'
import { loadAWords } from '@/lib/baked'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = parseInt(url.searchParams.get('surah') || '1')
  const ayah = parseInt(url.searchParams.get('ayah') || '1')

  const ayahData = loadAWords(surah)
  const words = ayahData?.[ayah] || []

  return json(words, 200, 86400)
}
