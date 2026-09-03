import { NextResponse } from 'next/server'
import booksData from '@/data/books.json'
import { listCustomBooks, bookKey, listHiddenKeys } from '@/lib/custom-books'

export const dynamic = 'force-dynamic'

let cachedResult: any[] | null = null
let cacheTime = 0
const CACHE_TTL = 60_000

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

export async function GET() {
  if (cachedResult && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResult, {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=60, max-age=60' },
    })
  }

  const baked: any[] = (booksData as any[]).map(b => ({ ...b, source: b.source || 'Dawaateislami' }))
  let custom: any[] = []
  let hidden = new Map<string, string>()
  try {
    custom = await listCustomBooks()
  } catch {}
  try {
    hidden = await listHiddenKeys()
  } catch {}

  const bakedByKey = new Map<string, any>()
  for (const b of baked) {
    const k = bookKey(b)
    if (k && !bakedByKey.has(k)) bakedByKey.set(k, b)
  }

  for (const b of custom) {
    const k = bookKey(b)
    if (k && bakedByKey.has(k)) {
      bakedByKey.set(k, { ...b, source: 'Custom' })
    }
  }

  const merged: any[] = []
  const seen = new Set<string>()
  for (const b of baked) {
    const k = bookKey(b)
    if (k && hidden.has(k)) continue
    if (k && seen.has(k)) continue
    if (k) seen.add(k)
    const override = k && bakedByKey.get(k)
    merged.push(override || b)
  }
  for (const c of custom) {
    const k = bookKey(c)
    if (k && seen.has(k)) continue
    if (k) seen.add(k)
    merged.push({ ...c, source: 'Custom' })
  }

  cachedResult = merged
  cacheTime = Date.now()

  return NextResponse.json(merged, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=60, max-age=60' },
  })
}
