import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const surah = parseInt(url.searchParams.get('surah') || '1')
  const ayah = parseInt(url.searchParams.get('ayah') || '1')

  const db = createQuranClient()

  function parseWbw(text: unknown): string[] {
    return getText(text).split('@').map((p: string) => {
      const idx = p.indexOf('&')
      return idx >= 0 ? p.slice(idx + 1).trim() : p.trim()
    }).filter(Boolean)
  }

  const [wbwRow] = await query(db, 'SELECT translation FROM tbl_word_by_word_new WHERE surat_id = ? AND ayat_number = ? ORDER BY id LIMIT 1', [surah, ayah])
  const urdu = wbwRow ? parseWbw(wbwRow.translation) : []

  const [engRow] = await query(db, 'SELECT translation FROM word_by_word_english WHERE surat_id = ? AND ayat_number = ? ORDER BY id LIMIT 1', [surah, ayah])
  const eng = engRow ? parseWbw(engRow.translation) : []

  const arabicRows = await query(db, 'SELECT arabic_word FROM tbl_arabic_words WHERE arabic_surat_id = ? AND arabic_ayat_number = ? ORDER BY word_id', [surah, ayah])
  const arabic = arabicRows.map(r => getText(r.arabic_word).trim())

  return json({ arabic, urdu, english: eng })
}
