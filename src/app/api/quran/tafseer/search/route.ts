import { createQuranClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS, COL_IS_URDU } from '@/lib/constants'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const type = url.searchParams.get('type') || ''

  if (!q.trim()) return error('Search query required', 400)

  const db = createQuranClient()
  const results: any[] = []

  const colInfo = type
    ? TAFSEER_COLUMNS.filter(([c]) => c === type)
    : TAFSEER_COLUMNS

  const words = q.trim().split(/\s+/).filter(Boolean)

  for (const [col, label] of colInfo) {
    const isUrdu = COL_IS_URDU[col] || false

    let sql: string
    let params: string[]

    if (words.length === 1) {
      sql = `SELECT surat_id, ayat_number, arabic, "${col}" FROM tbl_QuranComplete WHERE "${col}" LIKE ? LIMIT 50`
      params = [`%${q}%`]
    } else {
      const conditions = words.map(w => `"${col}" LIKE ?`)
      sql = `SELECT surat_id, ayat_number, arabic, "${col}" FROM tbl_QuranComplete WHERE ${conditions.join(' AND ')} LIMIT 50`
      params = words.map(w => `%${w}%`)
    }

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
        searchWords: words,
      })
    }
  }

  return json(results)
}
