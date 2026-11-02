import { NextResponse } from 'next/server'
import { listCustomBooks, listHiddenKeys } from '@/lib/custom-books'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked book list.
 *
 * The books themselves are served as a static file (`/data/books.json`) so the
 * Books tab paints instantly. Admin edits live in Turso; the visitor only needs
 * the small delta, and a slow/unavailable database must never block the page —
 * the client gives this route 1.5 s and falls back to the baked list.
 */
export async function GET() {
  try {
    const [custom, hidden] = await Promise.all([listCustomBooks(), listHiddenKeys()])
    return NextResponse.json(
      { custom, hidden: [...hidden.keys()] },
      { headers: { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' } }
    )
  } catch {
    return NextResponse.json({ custom: [], hidden: [] }, { headers: { 'cache-control': 'no-store' } })
  }
}
