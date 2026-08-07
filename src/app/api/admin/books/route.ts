import { createQuranClient, run, query } from '@/lib/db'
import { json, error } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export interface CustomBook {
  id?: number
  title: string
  author: string
  pages: string
  cover: string
  thumbnail: string
  url: string
  pdf: string
  audioUrl: string
  audioPlay: string
  audioDownload: string
  source?: string
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS tbl_CustomBooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  author TEXT,
  pages TEXT,
  cover TEXT,
  thumbnail TEXT,
  url TEXT,
  pdf TEXT,
  audioUrl TEXT,
  audioPlay TEXT,
  audioDownload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`

const COLS = 'title, author, pages, cover, thumbnail, url, pdf, audioUrl, audioPlay, audioDownload'

function cleanStr(v: unknown, max = 2000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

export async function GET() {
  try {
    const db = createQuranClient()
    await run(db, CREATE_SQL)
    const rows = await query(db, `SELECT id, ${COLS} FROM tbl_CustomBooks ORDER BY id DESC`)
    const books: CustomBook[] = rows.map((r: any) => ({
      id: r.id,
      title: String(r.title || ''),
      author: String(r.author || ''),
      pages: String(r.pages || ''),
      cover: String(r.cover || ''),
      thumbnail: String(r.thumbnail || ''),
      url: String(r.url || ''),
      pdf: String(r.pdf || ''),
      audioUrl: String(r.audioUrl || ''),
      audioPlay: String(r.audioPlay || ''),
      audioDownload: String(r.audioDownload || ''),
      source: 'Custom',
    }))
    return json({ books })
  } catch (e: any) {
    return error(e.message || 'Failed to list books', 500)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const books: CustomBook[] = Array.isArray(body) ? body : body.books
    if (!Array.isArray(books) || books.length === 0) return error('books array required')

    const db = createQuranClient()
    await run(db, CREATE_SQL)
    const existing = await query(db, `SELECT url, cover FROM tbl_CustomBooks`)
    const seen = new Set<string>()
    for (const r of existing as any[]) {
      if (r.url) seen.add(String(r.url))
      if (r.cover) seen.add(String(r.cover))
    }

    let inserted = 0
    let skipped = 0
    for (const b of books) {
      const title = cleanStr(b.title)
      const url = cleanStr(b.url)
      const cover = cleanStr(b.cover)
      if (!title && !url && !cover) continue
      const key = url || cover
      if (key && seen.has(key)) { skipped++; continue }
      if (key) seen.add(key)
      await run(
        db,
        `INSERT INTO tbl_CustomBooks (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          cleanStr(b.author) || 'N/A',
          cleanStr(b.pages) || 'N/A',
          cover,
          cleanStr(b.thumbnail),
          url,
          cleanStr(b.pdf),
          cleanStr(b.audioUrl),
          cleanStr(b.audioPlay),
          cleanStr(b.audioDownload),
        ]
      )
      inserted++
    }

    return json({ success: true, inserted, skipped })
  } catch (e: any) {
    return error(e.message || 'Import failed', 500)
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return error('id required')
    const db = createQuranClient()
    await run(db, CREATE_SQL)
    await run(db, `DELETE FROM tbl_CustomBooks WHERE id = ?`, [id])
    return json({ success: true })
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}
