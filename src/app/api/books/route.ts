import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export interface BookItem {
  title: string
  author: string
  pages: string
  cover: string
  url: string
  audioPlay: string
  audioDownload: string
  source: string
}

const BOOKS_DIR = path.join(process.cwd(), 'public', 'books')

let cached: BookItem[] | null = null
let cachedSignature: string | null = null

function sourceLabel(file: string): string {
  if (file.includes('alahazrat')) return 'Alahazrat'
  if (file.includes('audio')) return 'Dawateislami (Audio)'
  return 'Dawateislami'
}

interface ParsedBook {
  title: string
  author: string
  pages: string
  cover: string
  url: string
  audioPlay: string
  audioDownload: string
}

function parseCsv(content: string): ParsedBook[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const out: ParsedBook[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t')
    if (parts.length < 4) continue
    while (parts.length > 7) {
      parts[0] += '\t' + parts.splice(1, 1)[0]
    }
    const [titleRaw, authorRaw, pagesRaw, coverRaw, urlRaw, aPlayRaw, aDlRaw] = parts
    const item: ParsedBook = {
      title: (titleRaw || '').trim(),
      author: (authorRaw || '').trim() || 'N/A',
      pages: (pagesRaw || '').trim() || 'N/A',
      cover: (coverRaw || '').trim(),
      url: (urlRaw || '').trim(),
      audioPlay: (aPlayRaw || '').trim(),
      audioDownload: (aDlRaw || '').trim(),
    }
    if (item.title || item.url || item.cover) out.push(item)
  }
  return out
}

export async function GET() {
  const files = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.csv'))
  const signature = files.map(f => {
    try { return `${f}:${fs.statSync(path.join(BOOKS_DIR, f)).mtimeMs}` } catch { return `${f}:0` }
  }).join('|')
  if (cached && cachedSignature === signature) {
    return NextResponse.json(cached, { headers: { 'content-type': 'application/json' } })
  }

  const merged = new Map<string, BookItem>()
  files.sort().forEach(file => {
    const content = fs.readFileSync(path.join(BOOKS_DIR, file), 'utf8')
    const label = sourceLabel(file)
    for (const b of parseCsv(content)) {
      const key = b.url || b.cover
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, { ...b, source: label })
      } else if (!existing.audioPlay && b.audioPlay) {
        existing.audioPlay = b.audioPlay
        existing.audioDownload = b.audioDownload
        existing.source = label.includes('Dawateislami') ? existing.source : label
      }
    }
  })

  cached = Array.from(merged.values())
  cachedSignature = signature
  return NextResponse.json(cached, { headers: { 'content-type': 'application/json' } })
}