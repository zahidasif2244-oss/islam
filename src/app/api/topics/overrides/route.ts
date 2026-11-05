import { NextResponse } from 'next/server'
import { listTopicOverrides, topicOverridesCache } from '@/lib/topic-overrides'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked topic files.
 *
 * `/data/static/topics.json` and `/data/static/amazing_topics.json` stay on the
 * CDN (instant tab open). Admin edits live in Turso; the visitor only downloads
 * the delta and applies it to the static rows. `no-store` is intentional: after
 * an admin saves, the next normal reload must show the new row, not a cached
 * copy.
 *
 * The per-instance five-second cache collapses bursts of visitors into one
 * Turso read; every admin write invalidates it immediately.
 */
export async function GET() {
  const cacheHit = topicOverridesCache.get() !== null
  try {
    const rows = await listTopicOverrides()
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
      {
        headers: {
          'cache-control': 'no-store',
          'x-overlay-cache': cacheHit ? 'hit' : 'miss',
        },
      }
    )
  }
}
