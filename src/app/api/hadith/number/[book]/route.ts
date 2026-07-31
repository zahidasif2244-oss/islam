import { createHadithClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

export async function GET(req: Request, { params }: { params: Promise<{ book: string }> }) {
  const { book } = await params
  const q = new URL(req.url).searchParams.get('q') || ''

  try {
    const db = createHadithClient(book)
    const qn = q.trim()

    if (!qn) return json([])

    const rows = await query(db, `
      SELECT h.hadees_number, h.arabic, h.international_number,
             hl_ur.hadees as urdu_text, hl_en.hadees as english_text
      FROM hadees h
      LEFT JOIN hadees_languages hl_ur ON h.record_id = hl_ur.hadees_record_id AND hl_ur.language_id = 1
      LEFT JOIN hadees_languages hl_en ON h.record_id = hl_en.hadees_record_id AND hl_en.language_id = 2
      WHERE CAST(h.hadees_number AS TEXT) LIKE ? OR CAST(h.international_number AS TEXT) LIKE ?
      ORDER BY (CASE WHEN CAST(h.hadees_number AS TEXT) = ? THEN 0 ELSE 1 END),
               (CASE WHEN CAST(h.hadees_number AS TEXT) LIKE ? THEN 0 ELSE 1 END),
               (CASE WHEN CAST(h.international_number AS TEXT) = ? THEN 0 ELSE 1 END),
               CAST(h.hadees_number AS TEXT)
      LIMIT 30
    `, [`%${qn}%`, `%${qn}%`, qn, `${qn}%`, qn])

    return json(rows.map(r => ({
      number: r.hadees_number, international_number: r.international_number,
      arabic: getText(r.arabic), urdu: decodeUrdu(r.urdu_text),
      english: getText(r.english_text)
    })), 200, 300)
  } catch {
    return error('Book not found')
  }
}
