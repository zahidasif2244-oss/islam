import { json } from '@/lib/api-utils'

const awordsCache = new Map<number, Record<number, any[]>>()

function loadAWords(surah: number): Record<number, any[]> | null {
  if (awordsCache.has(surah)) return awordsCache.get(surah)!
  try {
    const data = require(`@/data/quran/awords-${surah}.json`)
    awordsCache.set(surah, data)
    return data
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = parseInt(url.searchParams.get('surah') || '1')
  const ayah = parseInt(url.searchParams.get('ayah') || '1')

  const ayahData = loadAWords(surah)
  const words = ayahData?.[ayah] || []

  return json(words, 200, 86400)
}
