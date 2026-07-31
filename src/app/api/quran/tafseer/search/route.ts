import { createQuranClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS, COL_IS_URDU } from '@/lib/constants'

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

let colCounts: Record<string, number> | null = null

async function getColCounts(db: any): Promise<Record<string, number>> {
  if (colCounts) return colCounts
  colCounts = {}
  for (const [col] of TAFSEER_COLUMNS) {
    const [r] = await query(db, `SELECT count(*) c FROM tbl_QuranComplete WHERE "${col}" IS NOT NULL AND "${col}" != ''`)
    colCounts[col] = Number(r.c) || 0
  }
  return colCounts
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const type = url.searchParams.get('type') || ''

  if (!q.trim()) return error('Search query required', 400)

  const db = createQuranClient()
  const results: any[] = []

  let colInfo = type
    ? TAFSEER_COLUMNS.filter(([c]) => c === type)
    : TAFSEER_COLUMNS

  if (!type) {
    const counts = await getColCounts(db)
    colInfo = colInfo.filter(([c]) => counts[c] > 0)
  }

  const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
  const phrase = typedWords.join(' ')

  for (const [col, label] of colInfo) {
    const isUrdu = COL_IS_URDU[col] || false
    const words = isUrdu ? typedWords.map(encodeUrdu) : typedWords
    const searchPhrase = isUrdu ? encodeUrdu(phrase) : phrase

    const orConds = words.map(w => `"${col}" LIKE ?`)
    const countExpr = words.map(w => `(CASE WHEN "${col}" LIKE ? THEN 1 ELSE 0 END)`).join(' + ')
    const phraseCond = `"${col}" LIKE ?`

    const sql = `SELECT surat_id, ayat_number, arabic, "${col}", (${countExpr}) AS match_count, (CASE WHEN ${phraseCond} THEN 1 ELSE 0 END) AS phrase_match FROM tbl_QuranComplete WHERE ${orConds.join(' OR ')} ORDER BY phrase_match DESC, match_count DESC, length("${col}") LIMIT 100`
    const params = [
      ...words.map(w => `%${w}%`),
      `%${searchPhrase}%`,
      ...words.map(w => `%${w}%`),
    ]

    const rows = await query(db, sql, params)
    for (const r of rows) {
      const text = r[col]
      if (text === null || text === undefined) continue
      results.push({
        surah: r.surat_id,
        ayah: r.ayat_number,
        arabic: getText(r.arabic || ''),
        tafseer: isUrdu ? decodeUrdu(text) : getText(text),
        tafseer_type: col,
        tafseer_label: label,
        searchWords: typedWords,
        match_count: Number(r.match_count) || 1,
        total_words: typedWords.length,
        phrase_match: Number(r.phrase_match) || 0,
      })
    }
  }

  return json(results)
}
