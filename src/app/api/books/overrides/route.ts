import { NextResponse } from 'next/server'
import { bookOverridesCache, listBookOverrides } from '@/lib/custom-books'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked book list.
 *
 * The books themselves are served as a static file (`/data/books.json`) so the
 * Books tab paints instantly. Admin edits live in Turso; the visitor only needs
 * the small delta, and a slow/unavailable database must never block the page —
 * the client gives this route 1.5 s and falls back to the baked list.
 *
 * Both overlay tables are read in one batch and cached for 30 s per instance
 * (the same window the CDN already uses), so a burst of visitors produces at
 * most one Turso read.
 */
export async function GET() {
  const cacheHit = bookOverridesCache.get() !== null
  try {
    const { custom, hidden } = await listBookOverrides()
    return NextResponse.json(
      { custom, hidden: [...hidden.keys()] },
      {
        headers: {
          'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
          'x-overlay-cache': cacheHit ? 'hit' : 'miss',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { custom: [], hidden: [] },
      { headers: { 'cache-control': 'no-store', 'x-overlay-cache': 'error' } }
    )
  }
}
