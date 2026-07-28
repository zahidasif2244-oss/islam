import { createQuranClient, query, getText, decodeUrdu } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { TAFSEER_COLUMNS } from '@/lib/constants'

export async function GET(req: Request, { params }: { params: Promise<{ surah: string; ayah: string }> }) {
  const { surah, ayah } = await params
  const db = createQuranClient()
  const cols = TAFSEER_COLUMNS.map(([c]) => `"${c}"`).join(', ')
  const [r] = await query(db, `SELECT ${cols} FROM tbl_QuranComplete WHERE surat_id = ? AND ayat_number = ? LIMIT 1`, [parseInt(surah), parseInt(ayah)])

  if (!r) return error('Ayah not found')

  const result: Record<string, string> = {}
  for (const [col, , isUrdu] of TAFSEER_COLUMNS) {
    if (r[col] === null || r[col] === undefined) result[col] = ''
    else if (isUrdu) result[col] = decodeUrdu(r[col])
    else result[col] = getText(r[col])
  }
  return json(result)
}
