import { createQuranClient, query } from '@/lib/db'
import { json } from '@/lib/api-utils'
import { TRANSLATION_COLUMNS } from '@/lib/constants'

export async function GET() {
  const db = createQuranClient()
  const results = await Promise.allSettled(
    TRANSLATION_COLUMNS.map(async ([col, label, isUrdu]) => {
      const [{ cnt }] = await query(db, `SELECT COUNT(*) as cnt FROM tbl_QuranComplete WHERE "${col}" IS NOT NULL AND "${col}" != ''`)
      return Number(cnt) > 0 ? { key: col, label, is_urdu: isUrdu, count: Number(cnt) } : null
    })
  )
  const types = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value).filter(Boolean)
  return json(types, 200, 86400)
}
