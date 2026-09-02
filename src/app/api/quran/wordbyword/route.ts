import { json } from '@/lib/api-utils'

const wbwCache = new Map<number, Record<number, any[]>>()

function loadWbw(surah: number): Record<number, any[]> | null {
  if (wbwCache.has(surah)) return wbwCache.get(surah)!
  try {
    const data = require(`@/data/quran/wbw-${surah}.json`)
    wbwCache.set(surah, data)
    return data
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = parseInt(url.searchParams.get('surah') || '1')
  const ayah = parseInt(url.searchParams.get('ayah') || '1')

  const ayahData = loadWbw(surah)
  const words = ayahData?.[ayah] || []

  const arabic = words.map(w => w.arabic || '')
  const urdu = words.map(w => w.urdu || '')
  const eng = words.map(w => w.english || '')
  const hindi = words.map(w => w.hindi || '')

  return json({ arabic, urdu, english: eng, hindi }, 200, 86400)
}
