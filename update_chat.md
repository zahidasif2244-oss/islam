# Update Chat — Fast-Loading Pass

**Date:** 2026-11-09
**Repository:** `C:\Users\madni\Documents\GitHub\islam`
**Branch:** `main` (HEAD `beb534a`, matching `origin/main`)
**Scope:** Fahmul, Mutradif, More (English Subjects / Urdu Subjects / Random Hadith), plus the More tab itself.

---

## 1. Conversation record

### User request

> good everything is working fine keep as it is, but Loading of Tabs "fahmul" ,"Mutradif", "More" Urdu Subject, English Subjects, Random Hadith, all loading is slow please make it's fast loading check in detail

### Follow-up

> now save all above chat in update_chat.md

### Previously completed work to preserve

- Listen player implemented and verified at `320x568`, `768x1024`, and desktop.
- Play, pause/resume, seek, previous/next, auto-advance, close, row sync, pagination clearance, and overflow checks passed.
- `npx tsc --noEmit` and `npm run build` passed before the performance work.
- User confirmed everything was working and asked to keep the Listen player as is.
- Admin pages, hadith reader, and mobile responsiveness must remain intact.

---

## 2. Investigation — what was actually slow

| Tab / endpoint | Data size | Live behaviour (before) | Root cause |
|---|---|---|---|
| Mutradif | 3006 entries, **3.86 MB raw** / 1.02 MB gzip / 643 KB br | **18.6–56.0 s** for the 1.07 MB transfer | Whole JSON downloaded, parsed, and every card rendered on click |
| Fahmul | 1117 entries, 278 KB raw / 76 KB gzip | ~1.3–1.9 s | Cold fetch started only on click; no prefetch |
| English Subjects | 1000 entries, 104 KB raw / 13 KB gzip | ~0.8–3.5 s | 1000 cards rendered at once (3112 DOM nodes) |
| Urdu Subjects | 1000 entries, 144 KB raw / 11 KB gzip | ~0.8 s | 1000 cards rendered at once (3112 DOM nodes) |
| Random Hadith | Turso-backed `/api/hadith/random` | ~0.75–2.4 s per request | Live DB round trip per request; route cached one answer for 5 minutes, so “Another” repeated |
| More | — | ~107 ms | Covered by the above fetches |

Other measured details:

- Local production render before optimisation: Fahmul 133 ms, Mutradif 469 ms (358 ms of that was the 1.05 MB transfer), English Subjects 174 ms with 3112 DOM nodes, Urdu Subjects 346 ms.
- Local `/api/hadith/random` returns 404 because `TURSO_QURAN_DB_URL` / `TURSO_QURAN_DB_TOKEN` are absent; live returns 200.
- Mutradif IDs are **not sequential** (`1, 2, 3, 10, ...`), so array-index sharding would break detail lookup.
- All 3006 Mutradif records have a summary (median 57 chars, p90 97, max 534), so the index can show useful summary cards.
- `statJson` de-duplicates requests per session, so a prefetch followed by a tab open performs only one network fetch.

---

## 3. Implemented changes

### `src/app/quran-app.tsx` (already committed in `HEAD`)

- `/quran/mutradif` now points to the compact `/static/mutradif-index.json`.
- Background warm-up at app idle (`requestIdleCallback`, 3 s fallback) and on nav-tab hover / touch / focus:
  - `prefetchSlowTabs`, `prefetchTabData`, `prefetchMoreContent`, `prefetchSubjects`, `prefetchSubjectsUrdu`.
- **Fahmul:** loading state + `ListSkeleton`; data warmed at idle.
- **Mutradif:**
  - Compact index for browsing/searching; `summary` shown on cards.
  - Full entries loaded from 64-ID shards (`MUTRADIF_SHARD_SIZE = 64`) via `loadMutradifDetail`; `prefetchMutradifDetail` warms the visible page.
  - `MutradifDetailLoader` shows the index summary immediately and swaps in the full entry when the shard arrives.
  - `ListSkeleton` while the index loads.
- **More / Subjects:**
  - `subjectsCache` and `subjectsUrduCache`; skeleton while loading.
  - `SUBJECT_PAGE_SIZE = 60`; pagination + search resets to page 1 for both lists.
  - Mount-time prefetch in `MoreTab`.
- **Random Hadith:**
  - In-session cache, inflight de-duplication, one-ahead queue (`takeRandomHadith`).
  - Card + `RandomHadithSkeleton`; “Another” renders instantly from memory.

### `scripts/export-static-data.mjs`

Generates the derived Mutradif assets at build time:

- `public/data/static/mutradif-index.json`
  - fields: `id, heading, word, urdu_head, alphabet, summary, total_ayat`
- `public/data/static/mutradif-details/<n>.json`
  - 48 shards of 64 ID buckets; IDs are looked up by `id`, not by array position.

Also updated the `--if-missing` dev probe to require both the index and at least one detail shard, so an old checkout cannot silently run without the new files.

### `src/app/api/hadith/random/route.ts`

- One `ORDER BY RANDOM() LIMIT 20` read fills a rotating pool, cached for 5 minutes per warm serverless instance.
- Each request returns the next pool entry (`cursor`), so consecutive requests differ while a burst of visitors costs one query.
- Responses now use `cache-control: no-store` (a cached “random” answer would repeat).
- Failures are not cached; the existing 4 s database timeout remains.

### `src/app/globals.css`

- `.mutradif-card .m-details` clamped to 3 lines so long summaries cannot bloat the list.

### Generated runtime assets

```text
public/data/static/mutradif-index.json        (753 KB raw / 138 KB gzip / 106 KB br)
public/data/static/mutradif-details/0.json … 47.json
                                              (~82 KB raw / ~22 KB gzip each)
```

`public/data` is gitignored and regenerated by `npm run build` (`data:export`).

---

## 4. Verification

- `npx tsc --noEmit` — passed.
- `npm run build` — passed (30 static pages generated).
- Data export — passed: `surahs=114 parahs=30 tafseer=1253 static=14`, 5292 files / 153.8 MB in `public/data`.
- Shard integrity — all **3006/3006** Mutradif IDs resolve to an entry in their shard.
- `--if-missing` dev probe — correctly skips export when `public/data` and the derived Mutradif files exist.
- Browser tests at a 498×629 viewport:
  - Mutradif search works (e.g. `رحم` → 9 word groups).
  - Mutradif pagination renders 10 cards per page.
  - Card open fetches exactly one detail shard (31,538 B) and shows the full entry with no “Loading” left.
  - English and Urdu Subjects render 60 cards per page, “Page 1 of 17”; page 2 shows the next 60.
  - No horizontal overflow on Fahmul, Mutradif, or Subjects.
  - Listen tab still renders all 114 surahs, 10 per page, with its audio player mounted.
  - Random Hadith failure path shows “Failed to load hadith.” locally (Turso credentials absent).

---

## 5. Before / after measurements

Local production build, 498×629 viewport, after idle warm-up:

| Item | Before | After |
|---|---|---|
| Fahmul tab | 133 ms + cold fetch | **52 ms**, 10 cards |
| Mutradif tab | 469 ms, 1.05 MB transfer | **68 ms**, **144 KB** transfer |
| Mutradif card detail | whole 1.05 MB file | **31 KB / 48 ms** |
| More tab | 107 ms | **36 ms** |
| English Subjects | 174 ms, 3112 DOM nodes | **48 ms**, **296 DOM nodes** |
| Urdu Subjects | 346 ms, 3112 DOM nodes | **63 ms**, 296 DOM nodes |

Payload impact:

- Mutradif browsing payload: 1.07 MB gzip → **138 KB gzip / 106 KB brotli** (about 7–10× smaller).
- Mutradif detail payload: ~22 KB gzip per opened card, only for the visible/opened IDs.
- Subjects DOM: 3112 → 296 nodes (about 90% fewer).

Cold-path note: if a tab is clicked before the idle prefetch finishes, the click waits for the shared in-flight request (index fetch was 165 ms locally for 144 KB). The skeleton covers this case.

---

## 6. Deployment notes / open items

- **Live deployment is stale.** `https://islam-pearl-zeta.vercel.app/data/static/mutradif-index.json` and `/mutradif-details/0.json` return **404**, so the new client and assets are not deployed yet. A Vercel rebuild/redeploy is required before live timings improve.
- Local Random Hadith success path cannot be exercised without `TURSO_QURAN_DB_URL` and `TURSO_QURAN_DB_TOKEN`; only the error path was verified locally. The live endpoint returns 200.
- No changes were made to the Listen player, hadith reader, admin pages, or existing API contracts.

### Working tree

Committed in `HEAD` (`beb534a`): the `quran-app.tsx` performance work and the dev probe.

Uncommitted at the end of this session:

```text
 M scripts/export-static-data.mjs       (Mutradif index + shard generation)
 M src/app/api/hadith/random/route.ts   (pool + no-store)
 M src/app/globals.css                  (3-line summary clamp)
```

The local production server on port `3126` was stopped.

---

## 7. Turso minimisation pass — 2026-11-10

### Request

> everything is working perfectly keep all as it is, just decrease turso.app usage minimize it usage near to zero or maximum low level usage consumption

Constraint: preserve every feature, UI state, API contract, admin page, and the 114-surah Listen player. The fast-tab work above must stay intact.

### Audit — every runtime Turso path

| Source | Trigger before | Cost |
|---|---|---|
| `/api/duas/overrides` | Every page load (global `useEffect`) | One overlay query per visit, `no-store`, 5 s cache |
| `/api/topics/overrides` | Every page load | Same |
| `/api/books/overrides` | Every page load | Two queries per visit, 30 s cache |
| `/api/hadith/random` | Any page load via idle warm-up + More | `ORDER BY RANDOM()` scan per 5 min per instance |
| `/api/admin/*` | Admin action only | Unchanged |
| Hadith/tafseer/Quran routes | — | Static files, no Turso |

`grep` confirms the only API files importing `@/lib/db` are the three overlay modules, `hadith/random`, and admin routes.

### Changes

**`src/app/quran-app.tsx`**
- Removed the three global overlay `useEffect` prefetches (Books, Duas, Topics).
- `prefetchTabData()` now warms an overlay only when its own nav tab is hovered, focused, touched, or opened.
- Split idle warm-up: `prefetchStaticMoreContent()` warms English/Urdu Subjects only. Random hadith is no longer requested during page idle; it starts when More is actually opened.
- Subjects keep their fast prefetch (`prefetchSlowTabs`), Fahmul and the Mutradif index still warm at idle.

**`src/lib/quran-static.ts`**
- Removed `cache: 'no-store'` from the three overlay fetches, so the browser may reuse the route's 60 s `max-age`. Session-level promise dedupe is unchanged.

**`src/lib/dua-overrides.ts`**
- Per-instance cache 5 s → 300 s.
- `listDuaOverrides()` no longer runs `CREATE TABLE`/DDL on the public read path. Admin write paths still ensure the table; a missing table means "no overrides".

**`src/lib/topic-overrides.ts`**
- Cache 5 s → 300 s.
- Extracted `selectTopicOverrides(db)`; strict `readTopicOverrides()` (admin) keeps DDL, public `listTopicOverrides()` skips DDL.

**`src/lib/custom-books.ts`**
- Cache 30 s → 300 s.
- `listBookOverrides()` no longer calls `ensureTables(db)`; admin paths still do.

**Overlay routes** (`duas`, `topics`, `books`)
- Success: `cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400`
- Errors remain `no-store` so a transient DB failure is retried immediately.
- Admin writes still invalidate the in-memory cache on the handling instance.

**`src/app/api/hadith/random/route.ts`**
- Pool TTL 5 min → 24 h; pool size 20 → 100.
- Worst case drops from ~288 `ORDER BY RANDOM()` scans per instance per day to one; the cursor still returns a different hadith for "Another".
- `no-store` retained — caching a random answer would repeat it.

### Resulting Turso traffic

- A casual page load: **zero API requests, zero Turso reads**.
- Opening Duas / Topics / Books: one overlay request for that tab only; shared edge cache for 5 minutes, browser cache for 60 s, and a 5-minute per-instance cache.
- Opening More: Subjects come from CDN; random hadith is one pooled query per warm instance per day.
- Admin panel: unchanged, reads the database directly.

### Verification

- `npx tsc --noEmit` — passed.
- `npm run build` — passed (30 static pages).
- curl on the local production build:
  - `/api/duas/overrides` → `200`, `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`
  - `/api/topics/overrides` → same header
  - `/api/books/overrides` → `no-store` locally only because Turso env vars are absent (fallback path)
- Fresh browser load, 4 s idle window: **no `/api/` entries**; Fahmul JSON and Mutradif index still prefetched.
- Duas 107 ms, Topics 145 ms, Books rendered "Showing 40 of 2471 books", More 26 ms.
- More → Random Hadith fired `/api/hadith/random` and showed "Failed to load hadith." locally, which is the expected error path without Turso credentials.
- No changes to the Listen player, hadith reader, admin pages, static data, or API shapes.

### Working tree

Fast-tab work plus the export script and CSS clamp are committed (`31ee82a`, `2fc8829`); `main` matches `origin/main` apart from the Turso edits.

Uncommitted at the end of this pass:

```text
 M src/app/quran-app.tsx
 M src/lib/quran-static.ts
 M src/lib/dua-overrides.ts
 M src/lib/topic-overrides.ts
 M src/lib/custom-books.ts
 M src/app/api/duas/overrides/route.ts
 M src/app/api/topics/overrides/route.ts
 M src/app/api/books/overrides/route.ts
 M src/app/api/hadith/random/route.ts
```

### Open item

The live deployment is still the stale build noted in section 6; `/data/static/mutradif-index.json` remains 404 until Vercel rebuilds. The Turso reductions take effect on that same redeploy.
