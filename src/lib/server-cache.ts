/**
 * Tiny per-instance TTL cache with single-flight de-duplication.
 *
 * The public site only needs a handful of small Turso reads (the two admin
 * overlays and the random hadith). Caching them for a few seconds per warm
 * serverless instance collapses bursts of visitors into one database read
 * without changing what any API returns.
 *
 * This is deliberately in-memory: it does not need a shared cache service and
 * a cold instance simply falls back to one normal read.
 */
const DEBUG = process.env.DB_DEBUG === '1'

type Entry<T> = { at: number; value: T }

export type ServerCache<T> = {
  get(): T | null
  load(fn: () => Promise<T>): Promise<T>
  invalidate(): void
}

export function createServerCache<T>(name: string, ttlMs: number): ServerCache<T> {
  let entry: Entry<T> | null = null
  let inflight: Promise<T> | null = null
  let generation = 0

  function get(): T | null {
    if (!entry) return null
    if (Date.now() - entry.at >= ttlMs) return null
    return entry.value
  }

  return {
    get,
    load(fn) {
      const fresh = get()
      if (fresh !== null) {
        if (DEBUG) console.log(`[cache] ${name} hit`)
        return Promise.resolve(fresh)
      }
      // Concurrent requests for the same data share one database read.
      if (inflight) {
        if (DEBUG) console.log(`[cache] ${name} join`)
        return inflight
      }

      const gen = generation
      if (DEBUG) console.log(`[cache] ${name} miss`)
      const promise = fn()
        .then(value => {
          // Do not let an in-flight read that started before an admin write
          // overwrite the freshly invalidated cache.
          if (gen === generation) entry = { at: Date.now(), value }
          return value
        })
        .finally(() => {
          if (inflight === promise) inflight = null
        })

      inflight = promise
      return promise
    },
    invalidate() {
      generation++
      entry = null
      inflight = null
      if (DEBUG) console.log(`[cache] ${name} invalidate`)
    },
  }
}
