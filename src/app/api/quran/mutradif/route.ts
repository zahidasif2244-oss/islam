import { createQuranClient, query, getText } from '@/lib/db'
import { json } from '@/lib/api-utils'

export async function GET() {
  const db = createQuranClient()
  const rows = await query(db, 'SELECT id, mutradif_id, alphabet, heading, word, details, summary, urdu_head_word, arabic_without_aerab, ayaat, total_ayat FROM tbl_urdu_mutradif ORDER BY alphabet, heading')
  const items = rows.map(r => ({
    id: r.id, mutradif_id: r.mutradif_id, alphabet: getText(r.alphabet),
    heading: getText(r.heading), word: getText(r.word),
    details: getText(r.details), summary: getText(r.summary),
    urdu_head: getText(r.urdu_head_word), arabic: getText(r.arabic_without_aerab),
    ayaat: getText(r.ayaat), total_ayat: r.total_ayat
  }))
  return json(items, 200, 86400)
}
