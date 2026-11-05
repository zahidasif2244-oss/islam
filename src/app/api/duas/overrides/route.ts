import { NextResponse } from 'next/server'
import { duaOverridesCache, listDuaOverrides } from '@/lib/dua-overrides'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked dua list.
 *
 * `/data/static/duas.json` stays on the CDN (instant tab open). Admin edits
 * live in Turso; the visitor only downloads the delta and applies it to the
 * static rows. `no-store` is intentional: after an admin saves, the next page
 * reload must show the new title, not a five-minute-old CDN copy.
 *
 * The per-instance five-second cache collapses bursts of visitors into one
 * Turso read; every admin write invalidates it immediately.
 */
export async function GET() {
  const cacheHit = duaOverridesCache.get() !== null
  try {
    const rows = await listDuaOverrides()
    return NextResponse.json(
      { rows },
      {
        headers: {
          'cache-control': 'no-store',
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
