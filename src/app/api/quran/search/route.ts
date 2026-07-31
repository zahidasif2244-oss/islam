import { createQuranClient, query, getText, cleanUrdu } from '@/lib/db'
import { normalizeArabicVariants } from '@/lib/arabic'
import { json } from '@/lib/api-utils'
import { quranWords, urduQuranMatches, arabicQuranMatches, getArabicIndex, mergeQuranHits, encodeUrduPhrase } from '@/lib/quran-search'

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') || ''
  const db = createQuranClient()
  const match = q.match(/^(\d+):(\d+)$/)

  if (match) {
    const rows = await query(db, `
      SELECT id, surat_id, ayat_number, arabic, translation_urdu, translation_english, translation_roman_urdu
      FROM tbl_QuranComplete WHERE surat_id = ? AND ayat_number = ? LIMIT 1
    `, [parseInt(match[1]), parseInt(match[2])])
    return json(rows.map(r => ({
      id: r.id, surah: r.surat_id, ayah: r.ayat_number,
      arabic: getText(r.arabic), urdu: cleanUrdu(r.translation_urdu, r.translation_roman_urdu),
      english: getText(r.translation_english), roman_urdu: getText(r.translation_roman_urdu)
    })))
  }

  const { typedWords, phrase, words } = quranWords(q)
  if (words.length === 0) return json([])

  const [urduRows, arabicIndex] = await Promise.all([
    urduQuranMatches(db, words, encodeUrduPhrase(phrase)),
    getArabicIndex(db),
  ])
  const arabicRows = arabicQuranMatches(arabicIndex, words, normalizeArabicVariants(phrase).map(v => v.text).filter(Boolean))
  return json(mergeQuranHits(urduRows, arabicRows, typedWords, typedWords.length))
}
