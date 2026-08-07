import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'books.json')

function sourceLabel(file) {
  if (file.includes('alahazrat')) return 'Alahazrat'
  if (file.includes('audio')) return 'Dawateislami'
  return 'Dawateislami'
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else cur += ch
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0)
  const out = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length < 6) continue
    const [
      titleRaw, authorRaw, pagesRaw, coverRaw, thumbRaw,
      urlRaw, pdfRaw, audioUrlRaw, aPlayRaw, aDlRaw,
    ] = cols
    const item = {
      title: (titleRaw || '').trim(),
      author: (authorRaw || '').trim() || 'N/A',
      pages: (pagesRaw || '').trim() || 'N/A',
      cover: (coverRaw || '').trim(),
      thumbnail: (thumbRaw || '').trim(),
      url: (urlRaw || '').trim(),
      pdf: (pdfRaw || '').trim(),
      audioUrl: (audioUrlRaw || '').trim(),
      audioPlay: (aPlayRaw || '').trim(),
      audioDownload: (aDlRaw || '').trim(),
    }
    if (item.title || item.url || item.cover) out.push(item)
  }
  return out
}

const files = fs.existsSync(BOOKS_DIR)
  ? fs.readdirSync(BOOKS_DIR).filter(f => f.toLowerCase().endsWith('.csv'))
  : []

if (files.length === 0) {
  if (fs.existsSync(OUT_FILE)) {
    console.warn('No .csv files found in public/books/ — keeping existing src/data/books.json')
    const kept = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
    console.log(`Books kept: ${kept.length}`)
    process.exit(0)
  }
  console.error('No .csv files found in public/books/ and src/data/books.json does not exist')
  process.exit(1)
}

const merged = new Map()
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
    } else if (!existing.pdf && b.pdf) {
      existing.pdf = b.pdf
    }
  }
})

const books = Array.from(merged.values())
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, JSON.stringify(books))

console.log(`Books written: ${books.length}`)
console.log(`Output: ${OUT_FILE}`)
console.log(`With audio: ${books.filter(b => b.audioPlay).length}`)
console.log(`With pdf: ${books.filter(b => b.pdf).length}`)
console.log(`Bad titles (contain ?): ${books.filter(b => /[?]/.test(b.title)).length}`)
