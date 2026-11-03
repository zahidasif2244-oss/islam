import { NextResponse } from 'next/server'
import { listDuaOverrides } from '@/lib/dua-overrides'

export const dynamic = 'force-dynamic'

/**
 * Tiny, best-effort overlay on top of the baked dua list.
 *
 * `/data/static/duas.json` stays on the CDN (instant tab open). Admin edits
 * live in Turso; the visitor only downloads the delta and applies it to the
 * static rows. `no-store` is intentional: after an admin saves, the next page
 * reload must show the new title, not a five-minute-old CDN copy.
 */
export async function GET() {
  try {
    const rows = await listDuaOverrides()
    return NextResponse.json(
      { rows },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { rows: [] },
      { headers: { 'cache-control': 'no-store' } }
    )
  }
}
