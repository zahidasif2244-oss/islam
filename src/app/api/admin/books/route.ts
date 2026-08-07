import { json, error } from '@/lib/api-utils'
import booksData from '@/data/books.json'
import {
  cleanStr,
  bookKey,
  listCustomBooks,
  listHiddenKeys,
  addHidden,
  removeHidden,
} from '@/lib/custom-books'
import { createQuranClient, run } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const CREATE_BOOKS_SQL = `
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

export interface AdminBook {
  id: number | null
  key: string
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
  source: string
  custom: boolean
  deleted: boolean
}

export async function GET(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const baked: any[] = (booksData as any[]).map(b => ({
      ...b,
      source: b.source || 'Dawaateislami',
      custom: false,
      id: null,
    }))
    const custom = await listCustomBooks()
    const hidden = await listHiddenKeys()
    const customByKey = new Map<string, any>()
    for (const c of custom) {
      const k = bookKey(c)
      if (k && !customByKey.has(k)) customByKey.set(k, c)
    }

    const books: AdminBook[] = baked.map((b): AdminBook => {
      const k = bookKey(b)
      const override = k ? customByKey.get(k) : null
      if (override) {
        return {
          id: override.id,
          key: k,
          title: override.title,
          author: override.author,
          pages: override.pages,
          cover: override.cover,
          thumbnail: override.thumbnail,
          url: override.url,
          pdf: override.pdf,
          audioUrl: override.audioUrl,
          audioPlay: override.audioPlay,
          audioDownload: override.audioDownload,
          source: b.source,
          custom: true,
          deleted: !!k && hidden.has(k),
        }
      }
      return {
        id: null,
        key: k,
        title: b.title,
        author: b.author,
        pages: b.pages,
        cover: b.cover,
        thumbnail: b.thumbnail,
        url: b.url,
        pdf: b.pdf,
        audioUrl: b.audioUrl,
        audioPlay: b.audioPlay,
        audioDownload: b.audioDownload,
        source: b.source,
        custom: false,
        deleted: !!k && hidden.has(k),
      }
    })

    for (const c of custom) {
      const k = bookKey(c)
      if (k && customByKey.get(k)?.id === c.id && !books.some(b => b.key === k)) {
        books.push({
          id: c.id,
          key: k,
          title: c.title,
          author: c.author,
          pages: c.pages,
          cover: c.cover,
          thumbnail: c.thumbnail,
          url: c.url,
          pdf: c.pdf,
          audioUrl: c.audioUrl,
          audioPlay: c.audioPlay,
          audioDownload: c.audioDownload,
          source: 'Custom',
          custom: true,
          deleted: false,
        })
      }
    }

    const deletedBooks = baked
      .filter(b => bookKey(b) && hidden.has(bookKey(b)))
      .map(b => ({ key: bookKey(b), title: b.title }))

    return json({ books, deletedBooks })
  } catch (e: any) {
    return error(e.message || 'Failed to list books', 500)
  }
}

export async function POST(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const books: any[] = Array.isArray(body) ? body : body.books
    if (!Array.isArray(books) || books.length === 0) return error('books array required')

    const db = createQuranClient()
    await run(db, CREATE_BOOKS_SQL)

    let inserted = 0
    let updated = 0
    let skipped = 0

    for (const b of books) {
      const row = {
        title: cleanStr(b.title),
        author: cleanStr(b.author) || 'N/A',
        pages: cleanStr(b.pages) || 'N/A',
        cover: cleanStr(b.cover),
        thumbnail: cleanStr(b.thumbnail),
        url: cleanStr(b.url),
        pdf: cleanStr(b.pdf),
        audioUrl: cleanStr(b.audioUrl),
        audioPlay: cleanStr(b.audioPlay),
        audioDownload: cleanStr(b.audioDownload),
      }
      const key = bookKey(b)
      const bakedKey = cleanStr(b.bakedKey).toLowerCase() || null

      if (b.id) {
        const existing: any = (
          await db.execute({ sql: `SELECT url, cover FROM tbl_CustomBooks WHERE id = ?`, args: [Number(b.id)] })
        ).rows[0]
        if (!existing) { skipped++; continue }
        await db.execute({
          sql: `UPDATE tbl_CustomBooks SET title=?, author=?, pages=?, cover=?, thumbnail=?, url=?, pdf=?, audioUrl=?, audioPlay=?, audioDownload=?, bakedKey=? WHERE id=?`,
          args: [row.title, row.author, row.pages, row.cover, row.thumbnail, row.url, row.pdf, row.audioUrl, row.audioPlay, row.audioDownload, bakedKey, Number(b.id)],
        })
        updated++
        continue
      }

      const existIdx = key
        ? await db.execute({
            sql: `SELECT id FROM tbl_CustomBooks WHERE lower(bakedKey) = ? OR lower(url) = ? OR lower(cover) = ?`,
            args: [key, key, key],
          })
        : { rows: [] }
      if (key && (existIdx.rows as any[]).length > 0) {
        const eid = (existIdx.rows[0] as any).id
        await db.execute({
          sql: `UPDATE tbl_CustomBooks SET title=?, author=?, pages=?, cover=?, thumbnail=?, url=?, pdf=?, audioUrl=?, audioPlay=?, audioDownload=?, bakedKey=? WHERE id=?`,
          args: [row.title, row.author, row.pages, row.cover, row.thumbnail, row.url, row.pdf, row.audioUrl, row.audioPlay, row.audioDownload, bakedKey, eid],
        })
        updated++
        continue
      }

      if (!row.title || (!row.url && !row.cover)) { skipped++; continue }
      await db.execute({
        sql: `INSERT INTO tbl_CustomBooks (title, author, pages, cover, thumbnail, url, pdf, audioUrl, audioPlay, audioDownload, bakedKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [row.title, row.author, row.pages, row.cover, row.thumbnail, row.url, row.pdf, row.audioUrl, row.audioPlay, row.audioDownload, bakedKey],
      })
      inserted++
    }

    return json({ success: true, inserted, updated, skipped })
  } catch (e: any) {
    return error(e.message || 'Import failed', 500)
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()

    if (body.id) {
      await run(createQuranClient(), `DELETE FROM tbl_CustomBooks WHERE id = ?`, [Number(body.id)])
      return json({ success: true, removed: 'custom' })
    }
    if (body.key) {
      await addHidden(body.key, body.title || '')
      return json({ success: true, removed: 'hidden' })
    }
    if (body.restoreKey) {
      await removeHidden(body.restoreKey)
      return json({ success: true, restored: true })
    }
    return error('id or key required', 400)
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}