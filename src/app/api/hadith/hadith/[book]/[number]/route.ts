import { createHadithClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

export async function GET(req: Request, { params }: { params: Promise<{ book: string; number: string }> }) {
  const { book, number } = await params

  try {
    const db = createHadithClient(book)
    const [r] = await query(db, `
      SELECT h.hadees_number, h.arabic, h.international_number,
             hl_ur.hadees as urdu_text, hl_ur.ravi as urdu_ravi_text,
             hl_en.hadees as english_text, hl_en.ravi as english_ravi_text
      FROM hadees h
      LEFT JOIN hadees_languages hl_ur ON h.record_id = hl_ur.hadees_record_id AND hl_ur.language_id = 1
      LEFT JOIN hadees_languages hl_en ON h.record_id = hl_en.hadees_record_id AND hl_en.language_id = 2
      WHERE h.hadees_number = ? LIMIT 1
    `, [parseInt(number)])

    if (!r) return error('Hadith not found')

    return json({
      number: r.hadees_number, international_number: r.international_number,
      arabic: getText(r.arabic), urdu: decodeUrdu(r.urdu_text),
      urdu_ravi: decodeUrdu(r.urdu_ravi_text), english: getText(r.english_text),
      english_ravi: getText(r.english_ravi_text)
    }, 200, 86400)
  } catch {
    return error('Book not found')
  }
}
