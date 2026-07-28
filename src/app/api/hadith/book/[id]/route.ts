import { createHadithClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { BOOK_NAMES } from '@/lib/constants'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 20
  const offset = (page - 1) * perPage

  try {
    const db = createHadithClient(id)
    const [{ cnt: total }] = await query(db, 'SELECT COUNT(*) as cnt FROM hadees')

    const rows = await query(db, `
      SELECT h.hadees_number, h.arabic, h.international_number,
             hl_ur.hadees as urdu_text, hl_ur.ravi as urdu_ravi,
             hl_en.hadees as english_text, hl_en.ravi as english_ravi
      FROM hadees h
      LEFT JOIN hadees_languages hl_ur ON h.record_id = hl_ur.hadees_record_id AND hl_ur.language_id = 1
      LEFT JOIN hadees_languages hl_en ON h.record_id = hl_en.hadees_record_id AND hl_en.language_id = 2
      ORDER BY h.hadees_number LIMIT ? OFFSET ?
    `, [perPage, offset])

    const hadiths = rows.map(r => ({
      number: r.hadees_number, international_number: r.international_number,
      arabic: getText(r.arabic), urdu: decodeUrdu(r.urdu_text),
      urdu_ravi: decodeUrdu(r.urdu_ravi), english: getText(r.english_text),
      english_ravi: getText(r.english_ravi)
    }))

    return json({
      hadiths, total: Number(total), page, pages: Math.ceil(Number(total) / perPage),
      name: BOOK_NAMES[id] || id
    }, 200, 300)
  } catch {
    return error('Book not found')
  }
}
