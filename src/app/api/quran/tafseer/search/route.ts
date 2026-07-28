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

  for (const [col, label] of colInfo) {
    const isUrdu = COL_IS_URDU[col] || false
    const rows = await query(db, `SELECT surat_id, ayat_number, arabic, "${col}" FROM tbl_QuranComplete WHERE "${col}" LIKE ? LIMIT 50`, [`%${q}%`])
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
      })
    }
  }

  return json(results)
}
