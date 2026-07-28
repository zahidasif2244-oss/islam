import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'
import { PARAH_NAMES } from '@/lib/constants'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT para_id, MIN(surat_id) as ss, MIN(ayat_number) as sa, MAX(surat_id) as es, MAX(ayat_number) as ea FROM tbl_QuranComplete WHERE para_id BETWEEN 1 AND 30 GROUP BY para_id ORDER BY para_id')
  const paras = rows.map(r => ({
    id: r.para_id, arabic_name: PARAH_NAMES[r.para_id as number] || '',
    start_surah: r.ss, start_ayah: r.sa,
    end_surah: r.es, end_ayah: r.ea
  }))
  return json(paras, 200, 86400)
}
