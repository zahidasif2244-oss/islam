import { json, error } from '@/lib/api-utils'
import { loadTafseer } from '@/lib/baked'

// Whole-surah tafseer for one column, so the browse view can lazy-load it
// only when the user actually turns the "Tafseer" toggle on.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const surahId = parseInt(id)
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || ''

  const data = loadTafseer(surahId)
  if (!data) return error('Tafseer not found')

  if (!type) {
    return json(data, 200, 86400)
  }

  const result: Record<string, string> = {}
  for (const [ayah, cols] of Object.entries(data)) {
    const text = cols && cols[type]
    if (text) result[ayah] = typeof text === 'string' ? text : String(text)
  }
  return json(result, 200, 86400)
}