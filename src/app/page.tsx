import QuranApp from './quran-app'
import { createQuranClient, query } from '@/lib/db'
import { SURAH_NAMES, SURAH_NAMES_EN, PARAH_NAMES, TRANSLATION_COLUMNS, TAFSEER_COLUMNS } from '@/lib/constants'

async function countEnabled(db: ReturnType<typeof createQuranClient>, cols: readonly (readonly [string, string, boolean])[]) {
  const results = await Promise.allSettled(
    cols.map(async ([col, label, isUrdu]) => {
      const [{ cnt }] = await query(db, `SELECT COUNT(*) as cnt FROM tbl_QuranComplete WHERE "${col}" IS NOT NULL AND "${col}" != ''`)
      return Number(cnt) > 0 ? { key: col, label, is_urdu: isUrdu, count: Number(cnt) } : null
    })
  )
  return results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value).filter(Boolean)
}

async function getInitial() {
  const db = createQuranClient()
  const [paras, translations, tafseerTypes] = await Promise.all([
    query(db, 'SELECT para_id, MIN(surat_id) as ss, MIN(ayat_number) as sa, MAX(surat_id) as es, MAX(ayat_number) as ea FROM tbl_QuranComplete WHERE para_id BETWEEN 1 AND 30 GROUP BY para_id ORDER BY para_id'),
    countEnabled(db, TRANSLATION_COLUMNS),
    countEnabled(db, TAFSEER_COLUMNS),
  ])
  const surahNames = []
  for (let i = 1; i < 115; i++) {
    surahNames.push({ id: i, arabic: SURAH_NAMES[i], english: SURAH_NAMES_EN[i] })
  }
  return {
    surahNames,
    parahNames: paras.map(r => ({
      id: r.para_id, arabic_name: PARAH_NAMES[r.para_id as number] || '',
      start_surah: r.ss, start_ayah: r.sa,
      end_surah: r.es, end_ayah: r.ea
    })),
    translations,
    tafseerTypes,
  }
}

export default async function Page() {
  const initial = await getInitial()
  return <QuranApp initial={initial} />
}
