import { createQuranClient, run, query } from '@/lib/db'

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

export async function ensureTables(db: ReturnType<typeof createQuranClient> = createQuranClient()) {
  await run(db, CREATE_BOOKS_SQL)
  await run(db, CREATE_HIDDEN_SQL)
  try {
    await run(db, MIGRATE_BAKED_KEY_SQL)
  } catch {}
}

export async function listCustomBooks(): Promise<any[]> {
  const db = createQuranClient()
  await ensureTables(db)
  const rows = await db.execute(`SELECT id, ${BOOK_COLS} FROM tbl_CustomBooks ORDER BY id DESC`)
  return rows.rows.map((r: any) => ({
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
}

export async function listHiddenKeys(): Promise<Map<string, string>> {
  const db = createQuranClient()
  await ensureTables(db)
  const rows = await db.execute(`SELECT key, title FROM tbl_HiddenBooks`)
  const map = new Map<string, string>()
  for (const r of rows.rows as any[]) {
    if (r.key) map.set(String(r.key).toLowerCase(), String(r.title || ''))
  }
  return map
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
}

export async function removeHidden(key: string) {
  const db = createQuranClient()
  await ensureTables(db)
  const cleanKey = cleanStr(key).toLowerCase()
  if (!cleanKey) return
  await db.execute({ sql: `DELETE FROM tbl_HiddenBooks WHERE key = ?`, args: [cleanKey] })
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