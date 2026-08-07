import { NextResponse } from 'next/server'
import booksData from '@/data/books.json'
import { createQuranClient, run, query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface BookItem {
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

export async function GET() {
  let custom: BookItem[] = []
  try {
    const db = createQuranClient()
    await run(db, CREATE_SQL)
    const rows = await query(
      db,
      `SELECT title, author, pages, cover, thumbnail, url, pdf, audioUrl, audioPlay, audioDownload FROM tbl_CustomBooks ORDER BY id DESC`
    )
    custom = rows.map((r: any) => ({
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
  } catch (e) {
    custom = []
  }
  return NextResponse.json([...custom, ...(booksData as any[])], {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
