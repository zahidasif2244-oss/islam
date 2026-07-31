import { createHadithClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

function encodeUrdu(text: string): string {
  let result = ''
  for (const c of text) {
    const cp = c.charCodeAt(0)
    if (cp >= 0x600 && cp <= 0x6FF) {
      let newCp = cp + 3
      if (newCp > 0x6FF) newCp = 0x600 + (newCp - 0x6FF - 1)
      result += String.fromCharCode(newCp)
    } else result += c
  }
  return result
}

const FIELDS = [
  { expr: 'hl_ur.hadees', enc: true },
  { expr: 'hl_ur.ravi', enc: false },
  { expr: 'hl_en.hadees', enc: false },
  { expr: 'hl_en.ravi', enc: false },
  { expr: 'h.arabic', enc: false },
] as const

export async function GET(req: Request, { params }: { params: Promise<{ book: string }> }) {
  const { book } = await params
  const q = new URL(req.url).searchParams.get('q') || ''

  try {
    const db = createHadithClient(book)
    const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
    if (typedWords.length === 0) return json([])
    const phrase = typedWords.join(' ')

    const pats = (w: string) => FIELDS.map(f => ({ p: f.enc ? `%${encodeUrdu(w)}%` : `%${w}%` }))
    const wordPats = typedWords.map(pats)
    const phrasePats = FIELDS.map(f => (f.enc ? `%${encodeUrdu(phrase)}%` : `%${phrase}%`))

    const countExpr = wordPats.map((wps, wi) =>
      `(CASE WHEN ${FIELDS.map((_, fi) => `${FIELDS[fi].expr} LIKE ?`).join(' OR ')} THEN 1 ELSE 0 END)`
    ).join(' + ')
    const phraseCond = FIELDS.map((_, fi) => `${FIELDS[fi].expr} LIKE ?`).join(' OR ')
    const orConds = wordPats.map(wps =>
      `(${FIELDS.map((_, fi) => `${FIELDS[fi].expr} LIKE ?`).join(' OR ')})`
    ).join(' OR ')

    const params: string[] = []
    for (let wi = 0; wi < wordPats.length; wi++) for (let fi = 0; fi < FIELDS.length; fi++) params.push(wordPats[wi][fi].p)
    for (const pp of phrasePats) params.push(pp)
    for (let wi = 0; wi < wordPats.length; wi++) for (let fi = 0; fi < FIELDS.length; fi++) params.push(wordPats[wi][fi].p)

    const rows = await query(db, `
      SELECT h.hadees_number, h.arabic, h.international_number,
             hl_ur.hadees as urdu_text, hl_ur.ravi as urdu_ravi_text,
             hl_en.hadees as english_text, hl_en.ravi as english_ravi_text,
             (${countExpr}) AS match_count,
             (CASE WHEN ${phraseCond} THEN 1 ELSE 0 END) AS phrase_match
      FROM hadees h
      LEFT JOIN hadees_languages hl_ur ON h.record_id = hl_ur.hadees_record_id AND hl_ur.language_id = 1
      LEFT JOIN hadees_languages hl_en ON h.record_id = hl_en.hadees_record_id AND hl_en.language_id = 2
      WHERE ${orConds}
      ORDER BY phrase_match DESC, match_count DESC, h.hadees_number
      LIMIT 50
    `, params)

    return json(rows.map(r => ({
      number: r.hadees_number, international_number: r.international_number,
      arabic: getText(r.arabic),
      urdu: decodeUrdu(r.urdu_text), urdu_ravi: getText(r.urdu_ravi_text),
      english: getText(r.english_text), english_ravi: getText(r.english_ravi_text),
      searchWords: typedWords,
      match_count: Number(r.match_count) || 1,
      total_words: typedWords.length,
      phrase_match: Number(r.phrase_match) || 0
    })), 200, 300)
  } catch {
    return error('Book not found')
  }
}
