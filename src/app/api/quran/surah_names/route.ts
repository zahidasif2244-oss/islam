import { json } from '@/lib/api-utils'
import { SURAH_NAMES, SURAH_NAMES_EN } from '@/lib/constants'

export async function GET() {
  const names = []
  for (let i = 1; i < 115; i++) {
    names.push({ id: i, arabic: SURAH_NAMES[i], english: SURAH_NAMES_EN[i] })
  }
  return json(names, 200, 86400)
}
