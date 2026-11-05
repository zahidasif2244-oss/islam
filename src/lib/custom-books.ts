import { createQuranClient, query, run } from '@/lib/db'
import { createServerCache } from '@/lib/server-cache'

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
  bakedKey TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`

const MIGRATE_BAKED_KEY_SQL = `ALTER TABLE tbl_CustomBooks ADD COLUMN bakedKey TEXT`

const CREATE_HIDDEN_SQL = `
CREATE TABLE IF NOT EXISTS tbl_HiddenBooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE,
  title TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`

export const BOOK_COLS = 'title, author, pages, cover, thumbnail, url, pdf, audioUrl, audioPlay, audioDownload, bakedKey'

export function cleanStr(v: unknown, max = 2000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

export function bookKey(b: any): string {
  return (cleanStr(b.bakedKey) || cleanStr(b.url) || cleanStr(b.cover)).toLowerCase()
}

export function normalizeKey(key: string): string {
  return cleanStr(key).toLowerCase()
}

/**
 * Table setup used to run six DDL statements on every overlay request (three
 * from each listing helper). It only ever needs to run once per server
 * instance; the PRAGMA also avoids a failing ALTER on every request.
 */
let tablesPromise: Promise<void> | null = null

export function ensureTables(db = createQuranClient()): Promise<void> {
  if (!tablesPromise) {
    tablesPromise = (async () => {
      await run(db, CREATE_BOOKS_SQL)
      await run(db, CREATE_HIDDEN_SQL)
      const columns = await query(db, `PRAGMA table_info(tbl_CustomBooks)`)
      const hasBakedKey = columns.some((c: any) => String(c.name || '') === 'bakedKey')
      if (!hasBakedKey) {
        try {
          await run(db, MIGRATE_BAKED_KEY_SQL)
        } catch {}
      }
    })().catch(err => {
      // Allow a later request to retry if the database was briefly unreachable.
      tablesPromise = null
      throw err
    })
  }
  return tablesPromise
}

export type BookOverrides = { custom: any[]; hidden: Map<string, string> }

/**
 * The public Books tab reads this overlay on every page load. Thirty seconds
 * matches the route's existing CDN `s-maxage`, so visitors never see anything
 * staler than they already could; admin writes invalidate the local copy.
 */
export const bookOverridesCache = createServerCache<BookOverrides>('book-overrides', 30_000)

export function invalidateBookOverrides(): void {
  bookOverridesCache.invalidate()
}

/** One batched read (one round trip) for both overlay lists. */
export async function listBookOverrides(): Promise<BookOverrides> {
  return bookOverridesCache.load(async () => {
    const db = createQuranClient()
    await ensureTables(db)

    const [customResult, hiddenResult] = await db.batch(
      [
        `SELECT id, ${BOOK_COLS} FROM tbl_CustomBooks ORDER BY id DESC`,
        `SELECT key, title FROM tbl_HiddenBooks`,
      ],
      'read'
    )

    const custom = customResult.rows.map((r: any) => ({
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
    }))

    const hidden = new Map<string, string>()
    for (const r of hiddenResult.rows as any[]) {
      if (r.key) hidden.set(String(r.key).toLowerCase(), String(r.title || ''))
    }

    return { custom, hidden }
  })
}

export async function listCustomBooks(): Promise<any[]> {
  return (await listBookOverrides()).custom
}

export async function listHiddenKeys(): Promise<Map<string, string>> {
  return (await listBookOverrides()).hidden
}

export async function addHidden(key: string, title = '') {
  const db = createQuranClient()
  await ensureTables(db)
  const cleanKey = cleanStr(key).toLowerCase()
  if (!cleanKey) return
  await db.execute({
    sql: `INSERT INTO tbl_HiddenBooks (key, title) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
    args: [cleanKey, cleanStr(title, 500)],
  })
  invalidateBookOverrides()
}

export async function removeHidden(key: string) {
  const db = createQuranClient()
  await ensureTables(db)
  const cleanKey = cleanStr(key).toLowerCase()
  if (!cleanKey) return
  await db.execute({ sql: `DELETE FROM tbl_HiddenBooks WHERE key = ?`, args: [cleanKey] })
  invalidateBookOverrides()
}

export function toBookRow(b: any) {
  return {
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
}
