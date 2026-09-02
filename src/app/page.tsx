import QuranApp from './quran-app'
import { SURAH_NAMES, SURAH_NAMES_EN } from '@/lib/constants'
import translations from '@/data/static/translations.json'
import tafseerTypes from '@/data/static/tafseer_types.json'
import parahNames from '@/data/static/parah_names.json'

function getInitial() {
  const surahNames = []
  for (let i = 1; i < 115; i++) {
    surahNames.push({ id: i, arabic: SURAH_NAMES[i], english: SURAH_NAMES_EN[i] })
  }
  return {
    surahNames,
    parahNames,
    translations,
    tafseerTypes,
  }
}

export default async function Page() {
  const initial = getInitial()
  return <QuranApp initial={initial} />
}
