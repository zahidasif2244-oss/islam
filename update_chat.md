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
