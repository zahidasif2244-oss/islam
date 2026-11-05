import type { InStatement } from '@libsql/client'
import { json, error } from '@/lib/api-utils'
import booksData from '@/data/books.json'
import {
  BOOK_COLS,
  cleanStr,
  bookKey,
  ensureTables,
  listBookOverrides,
  addHidden,
  removeHidden,
  invalidateBookOverrides,
} from '@/lib/custom-books'
import { createQuranClient, query, run } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

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

/** Keep each HTTP batch comfortably below request-size limits. */
const WRITES_PER_BATCH = 200

const IMPORT_COLS = [
  'title', 'author', 'pages', 'cover', 'thumbnail', 'url',
  'pdf', 'audioUrl', 'audioPlay', 'audioDownload', 'bakedKey',
] as const

/** Treat NULL and '' as the same empty value so unchanged rows are not rewritten. */
function sameBook(existing: any, args: unknown[]): boolean {
  return IMPORT_COLS.every((col, i) => String(existing[col] ?? '') === String(args[i] ?? ''))
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
    // One cached/batched read for both overlay tables.
    const { custom, hidden } = await listBookOverrides()
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
    await ensureTables(db)

    // One read for all existing rows, then one batched write. The old loop did
    // a SELECT and an UPDATE/INSERT per imported book (2,471 rows = up to
    // ~5,000 round trips).
    const existing = await query(
      db,
      `SELECT id, ${BOOK_COLS} FROM tbl_CustomBooks ORDER BY id`
    )
    const byId = new Map<number, any>()
    const byKey = new Map<string, number>()
    for (const r of existing) {
      const id = Number(r.id)
      if (!Number.isFinite(id)) continue
      byId.set(id, r)
      for (const v of [r.bakedKey, r.url, r.cover]) {
        const k = String(v || '').toLowerCase()
        if (k && !byKey.has(k)) byKey.set(k, id)
      }
    }

    const updateSql = `UPDATE tbl_CustomBooks SET title=?, author=?, pages=?, cover=?, thumbnail=?, url=?, pdf=?, audioUrl=?, audioPlay=?, audioDownload=?, bakedKey=? WHERE id=?`
    const insertSql = `INSERT INTO tbl_CustomBooks (title, author, pages, cover, thumbnail, url, pdf, audioUrl, audioPlay, audioDownload, bakedKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    const statements: InStatement[] = []
    const pendingByKey = new Map<string, number>()
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
      const args = [
        row.title, row.author, row.pages, row.cover, row.thumbnail, row.url,
        row.pdf, row.audioUrl, row.audioPlay, row.audioDownload, bakedKey,
      ]

      if (b.id) {
        const targetId = Number(b.id)
        const current = byId.get(targetId)
        if (!current) { skipped++; continue }
        if (!sameBook(current, args)) {
          statements.push({ sql: updateSql, args: [...args, targetId] })
        }
        updated++
        continue
      }

      if (key && byKey.has(key)) {
        const targetId = byKey.get(key)!
        const current = byId.get(targetId)
        if (current && sameBook(current, args)) {
          updated++
          continue
        }
        statements.push({ sql: updateSql, args: [...args, targetId] })
        updated++
        continue
      }

      // A duplicate key inside the same import used to update the row that the
      // previous loop iteration inserted. Merge it into that pending INSERT.
      if (key && pendingByKey.has(key)) {
        statements[pendingByKey.get(key)!] = { sql: insertSql, args }
        updated++
        continue
      }

      if (!row.title || (!row.url && !row.cover)) { skipped++; continue }
      const index = statements.length
      statements.push({ sql: insertSql, args })
      if (key) pendingByKey.set(key, index)
      inserted++
    }

    for (let i = 0; i < statements.length; i += WRITES_PER_BATCH) {
      await db.batch(statements.slice(i, i + WRITES_PER_BATCH), 'write')
    }
    if (statements.length) invalidateBookOverrides()

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
      invalidateBookOverrides()
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
