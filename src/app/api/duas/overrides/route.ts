import { NextResponse } from 'next/server'
import { duaOverridesCache, listDuaOverrides } from '@/lib/dua-overrides'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked dua list.
 *
 * `/data/static/duas.json` stays on the CDN (instant tab open). Admin edits
 * live in Turso; the visitor only downloads the delta and applies it to the
 * static rows.
 *
 * The response is edge-cached for five minutes (shared by every visitor) and
 * the in-memory copy matches that window. That keeps Turso reads to at most
 * one per edge region per five minutes, instead of one per page load. An
 * admin save is visible on the public site within that window and immediately
 * in the admin panel (which reads the database directly).
 */
export async function GET() {
  const cacheHit = duaOverridesCache.get() !== null
  try {
    const rows = await listDuaOverrides()
    return NextResponse.json(
      { rows },
      {
        headers: {
          'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
          'x-overlay-cache': cacheHit ? 'hit' : 'miss',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { rows: [] },
      { headers: { 'cache-control': 'no-store', 'x-overlay-cache': 'error' } }
    )
  }
}
