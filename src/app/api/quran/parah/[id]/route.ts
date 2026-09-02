import { json, error } from '@/lib/api-utils'
import { COL_IS_URDU } from '@/lib/constants'
import parahNames from '@/data/static/parah_names.json'

const parahCache = new Map<number, any[]>()

function loadParahVerses(paraId: number): any[] | null {
  if (parahCache.has(paraId)) return parahCache.get(paraId)!
  const info = parahNames.find(p => p.id === paraId)
  if (!info) return null

  const verses: any[] = []
  for (let sid = info.start_surah; sid <= info.end_surah; sid++) {
    try {
      const ayahs: any[] = require(`@/data/quran/surah-${sid}.json`)
      for (const a of ayahs) {
        if (sid === info.start_surah && a.ayat_number < info.start_ayah) continue
        if (sid === info.end_surah && a.ayat_number > info.end_ayah) continue
        verses.push(a)
      }
    } catch { continue }
  }
  parahCache.set(paraId, verses)
  return verses
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paraId = parseInt(id)
  const url = new URL(req.url)
  const tarjma = url.searchParams.get('tarjma') || 'translation_urdu'
  const tafseer = url.searchParams.get('tafseer') || ''

  const ayahs = loadParahVerses(paraId)
  if (!ayahs) return error('Parah not found')

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
