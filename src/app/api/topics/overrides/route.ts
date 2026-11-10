import { NextResponse } from 'next/server'
import { listTopicOverrides, topicOverridesCache } from '@/lib/topic-overrides'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked topic files.
 *
 * `/data/static/topics.json` and `/data/static/amazing_topics.json` stay on the
 * CDN (instant tab open). Admin edits live in Turso; the visitor only downloads
 * the delta and applies it to the static rows.
 *
 * Edge-cached for five minutes (shared by every visitor), with an in-memory
 * copy matching that window, so Turso reads stay at most one per region per
 * five minutes instead of one per page load. Admin writes invalidate the
 * in-memory copy immediately.
 */
export async function GET() {
  const cacheHit = topicOverridesCache.get() !== null
  try {
    const rows = await listTopicOverrides()
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
      {
        headers: {
          'cache-control': 'no-store',
          'x-overlay-cache': cacheHit ? 'hit' : 'miss',
        },
      }
    )
  }
}
