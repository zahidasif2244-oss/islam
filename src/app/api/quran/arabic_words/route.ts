import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = parseInt(url.searchParams.get('surah') || '1')
  const ayah = parseInt(url.searchParams.get('ayah') || '1')

  const db = createQuranClient()
  const rows = await query(db, `
    SELECT arabic_word, meaning, english_meaning, urdu_meaning, root,
           word_id, arabic_without_aeraab_arabic
    FROM tbl_arabic_words WHERE arabic_surat_id = ? AND arabic_ayat_number = ? ORDER BY word_id
  `, [surah, ayah])

  const words = rows.map(r => ({
    word: getText(r.arabic_word), meaning: getText(r.meaning),
    english: getText(r.english_meaning), urdu: getText(r.urdu_meaning),
    root: getText(r.root), word_id: r.word_id,
    without_aeraab: getText(r.arabic_without_aeraab_arabic)
  }))
  return json(words)
}
