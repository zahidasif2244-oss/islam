import { json } from '@/lib/api-utils'
import { loadWbw } from '@/lib/baked'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = parseInt(url.searchParams.get('surah') || '1')
  const ayah = parseInt(url.searchParams.get('ayah') || '1')

  const ayahData = loadWbw(surah)
  const words = ayahData?.[ayah] || []

  const arabic = words.map((w: any) => w.arabic || '')
  const urdu = words.map((w: any) => w.urdu || '')
  const eng = words.map((w: any) => w.english || '')
  const hindi = words.map((w: any) => w.hindi || '')

  return json({ arabic, urdu, english: eng, hindi }, 200, 86400)
}
