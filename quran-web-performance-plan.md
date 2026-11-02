# Quran Web — Speed & Database Reduction Plan

**Site audited:** https://islam-pearl-zeta.vercel.app
**Date:** 31 October 2026
**Stack detected:** Next.js 15 (App Router, Turbopack) on Vercel · Turso/libSQL · single-page client app

---

## 1. Executive summary

Your site is slow for **one dominant reason**, and it is not the database size.

> **Every surah, parah, tafseer and search request goes through a Vercel serverless function that is running in Washington DC (`iad1`) and queries Turso with no index-backed access path. Nothing is pre-rendered. Measured cold-load times were 4.6 s – 166 s.**

A cached repeat is fast (638 ms), but your cache keys number in the tens of thousands, so most visits are a miss.

The fix is not "tune Turso". The Quran corpus is **immutable, public, and tiny** (~2.5 MB of text for the whole book plus one translation). Immutable content should never touch a database on read. Move it to the CDN as static files, keep Turso for user data only, and you get:

| | Now (cold) | After |
|---|---|---|
| Surah data load | **4.6 – 166 s** | **~30–80 ms** |
| Al-Baqarah payload | **700 KB** | **~25 KB** (brotli) |
| Turso rows read / page view | ~6,000 – 25,000 | **0** |
| DB size (est.) | ~150–250 MB | **~25–35 MB** |
| Free-tier headroom | tight on rows-read | effectively unlimited |

All of this fits inside the **Turso free plan** (5 GB storage, 500 M rows read/month) — and after the change you will use a rounding error of it.

---

## 2. What I actually measured

### 2.1 API latency (cold cache, from Karachi → `bom1` edge → `iad1` function)

| Endpoint | Result | Time | Payload |
|---|---|---|---|
| `/api/quran/surah/1?tarjma=translation_english` | 200 | **25.7 s** | 4.7 KB |
| `/api/quran/surah/2?...` (286 ayahs) | 200 | **24.4 s** | 699.8 KB |
| `/api/quran/surah/18?...` (110 ayahs) | 200 | **165.9 s** | 186.5 KB |
| `/api/quran/parah/1?...` | 200 | **26.3 s** | 293.7 KB |
| `/api/quran/ayahs?surah=2&start=1&end=7` | 200 | **22.4 s** | 7.6 KB |
| `/api/quran/ayahs?surah=114&start=1&end=1` | 200 | **4.6 – 7.7 s** | 0.6 KB |
| `/api/quran/tafseer/2/255` | 200 | **23.1 s** | 71.1 KB |
| `/api/quran/wordbyword?surah=2&ayah=255` | 200 | **90.8 s** | 3.7 KB |
| `/api/quran/search?q=mercy` | **504** | **300 s timeout** | — |
| `/api/quran/search_text?q=mercy` | 200 | **54.7 s** | `no-store` |

### 2.2 The same endpoints, warm (CDN hit)

| Endpoint | Time |
|---|---|
| `/api/quran/surah/1?...` | **638 ms** |
| `/api/duas/all` | 416–559 ms |
| `/api/hadith/books` | 70 ms |

This is the single most important finding: **identical code is 40× faster when Vercel's CDN has it cached.** The slowness is entirely in the cold path.

### 2.3 Control tests (proving it is the data path, not the network)

| Endpoint | Cache | Time |
|---|---|---|
| `/api/hadith/books` (114 rows) | MISS | **2.0 s** |
| `/api/hadith/random` (1 row) | MISS | **9.0 s** |
| `/api/duas/all` | HIT | 0.5 s |

A 114-row lookup taking 2 s, and a *single random row* taking 9 s, means the cost is **connection setup per invocation plus full-table scans**, not payload size.

### 2.4 Infrastructure facts

- `X-Vercel-Id: bom1::iad1::…` → edge is Mumbai, **function executes in `iad1` (US-East)**. Every API call crosses the Atlantic twice.
- `/api/quran/*` responses carry `Cache-Control: public, max-age=86400` — **no `s-maxage`, no `stale-while-revalidate`**.
- `/api/quran/search_text` is `no-store` → **never cached, always a 20–55 s request**.

### 2.5 Front-end facts

| Item | Measured |
|---|---|
| Homepage HTML | 87 KB (pre-rendered, edge-cached) |
| JS + CSS transfer (brotli) | **216.5 KB** across 8 files |
| Web fonts | **408.8 KB** across 8 files |
| Google Fonts CSS (3rd-party, render-blocking) | **2.0 s** |
| Routes that exist | `/`, `/privacy`, `/dua-shifa` — **that's all** |
| `/surah/2`, `/hadith`, `/word-by-word` | **404** |
| Sitemap URLs | 3 |

The whole site is one page at `/`; surah navigation is client-side state only.

---

## 3. Root causes, ranked by impact

### Cause 1 — Immutable content is behind a remote database (critical)
Every surah view is a cold serverless invocation + a Turso round trip. The Quran has not changed in 1,400 years; there is nothing to query.

### Cause 2 — The function runs 12,000 km from your users (critical)
`iad1` for a Pakistan/India audience. Even a perfect query pays ~250 ms RTT per round trip, multiplied by N+1 queries.

### Cause 3 — Cache-key explosion (high)
Cached responses are keyed per surah × 25 translations × 11 tafseers = **~70,000 possible keys** for tafseer alone. Vercel cannot keep these warm. So most views are misses, and every miss is a 20 s+ request.

### Cause 4 — Wide rows / no `SELECT` discipline (high)
A `tarjma=translation_english` request still returns **six text columns per ayah**:

```
arabic, arabic_tajweed, urdu, english, roman_urdu, hindi
```

`arabic_tajweed` is a **second full copy of the Arabic text**, 25× translations are stored as separate tables, and the client is sent every language whether it renders it or not. This is why Al-Baqarah is 700 KB for what should be ~25 KB compressed.

### Cause 5 — Likely missing composite indexes + N+1 queries (high)
A 6-ayah lookup costing 25 s, and a 110-ayah surah costing 166 s, while a 286-ayah surah costs 24 s, is the signature of per-row queries and/or unindexed scans rather than one range query. **Verify in 2 minutes** (see §7.1) — `EXPLAIN QUERY PLAN` will show `SCAN` where it should show `SEARCH`.

### Cause 6 — Whole surah in one blocking request (medium)
No pagination, no streaming. The reader shows nothing until the last byte of a 700 KB response arrives.

### Cause 7 — Client-side rendering for everything (medium)
No per-surah URLs means no pre-rendered HTML, no deep links, no sharing, no SEO for 6,236 ayahs, and a JS waterfall before any text appears.

### Cause 8 — Render-blocking third-party fonts (medium)
408 KB of Google Fonts fetched through a render-blocking CSS request that took 2.0 s. Noto Nastaliq Urdu is very heavy and is only needed for Urdu prose, not for Quran Arabic.

---

## 4. The recommended architecture: static-first

### 4.1 The core insight

The full Quran is **small**. Actual UTF-8 sizes:

| Content | Raw | Brotli |
|---|---|---|
| Arabic text, all 6,236 ayahs | ~1.55 MB | ~600 KB |
| One translation edition | ~1.1 MB | ~450 KB |
| One tafseer edition | ~8–12 MB | ~3–4 MB |

Even the entire Quran with 25 translation editions is only ~30 MB raw. It fits in a single static directory — served by Vercel's CDN, cached forever at the edge, **zero function invocations, zero database reads, unmetered and free**.

Use this rule: **if the bytes are the same for every visitor, they belong on the CDN, not in a query.**

### 4.2 Target request flow

```
Browser ──► Vercel Edge CDN ──► static HTML + static JSON      (~20–60 ms, 0 functions)
                                        │
                                        └── only for user data:
                                            /api/bookmarks  ──► Turso   (5–20 rows)
```

### 4.3 What Turso keeps

| Data | Storage |
|---|---|
| Bookmarks, notes, last-read position, reading streaks | **Turso** (small, mutable, per-user) |
| Contact form, feedback, view counters | **Turso** |
| Quran text, translations, tafseers, word-by-word, duas, hadith | **Static files on CDN** |

After this split your Turso usage is a few thousand rows per day instead of millions.

---

## 5. Migration plan (4 phases, ~1 week of evenings)

### Phase 0 — Quick wins, today, ~2 hours, no refactor

These three changes alone will cut cold loads from ~25 s to ~2 s.

**(a) Move the function to your users' region.**

`vercel.json`:
```json
{
  "regions": ["bom1"]
}
```
> Hobby plan allows one region. Also recreate/move the Turso database to **`aws-ap-south-1` (Mumbai)** via the Turso dashboard → *Create database → Location*. Function and database in the same region removes most of the RTT.

**(b) Stop the CDN from ever missing.** In every `/api/quran/*` route handler:
```ts
headers: {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=2592000',
}
```
`stale-while-revalidate` means a stale copy is served **instantly** while a fresh one is built in the background — the 25 s never reaches a user again.

**(c) Trim the payload.** In the query, select only what is displayed:
```ts
// before
const rows = await db.execute(`SELECT * FROM quran WHERE surah = ?`, [id]);

// after
const rows = await db.execute(
  `SELECT a.ayah, a.arabic, t.text AS translation
     FROM ayah a
     LEFT JOIN translation t
       ON t.surah_id = a.surah_id AND t.ayah_no = a.ayah_no AND t.edition = ?
    WHERE a.surah_id = ?
    ORDER BY a.ayah_no`,
  [edition, id]
);
```
Expected: Al-Baqarah 700 KB → ~120 KB raw / ~30 KB brotli.

**Also: reuse the Turso connection.** Create the client **once at module scope**, not per request:

```ts
// lib/db.ts
import { createClient } from '@libsql/client/web';
export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
```
A per-request `createClient` pays TLS + auth handshake every time — that is your ~2 s floor.

---

### Phase 1 — Get the database out of the read path (1–2 evenings, biggest win)

Two options. **Option A is recommended.**

#### Option A — Build-time JSON export (recommended)

A script exports the corpus from Turso once, into static files committed to the repo or generated in CI:

```
public/data/
  surah/1.json … surah/114.json        # Arabic + default translation, per surah
  surah/2/en.json, 2/ur.json …         # one file per (surah, edition)
  parah/1.json … parah/30.json
  tafseer/jalalain/2.json …            # loaded on demand only
  meta/surahs.json, meta/parahs.json, meta/editions.json
```

File shape (keep keys short — you ship 6,236 of them):
```json
[{"a":1,"ar":"بِسْمِ اللَّهِ…","t":"In the name of Allah…"},
 {"a":2,"ar":"الْحَمْدُ لِلَّهِ…","t":"[All] praise is due to Allah…"}]
```

Client change is one line:
```ts
// before
const url = `/api/quran/surah/${surah}?tarjma=${edition}`;
// after
const url = `/data/surah/${surah}/${editionKey}.json`;
```

Served with:
```ts
// next.config.ts
async headers() {
  return [{
    source: '/data/:path*',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  }];
}
```

Result: **0 ms database time, ~40 ms CDN time, 0 rows read, $0.**

#### Option B — Pre-rendered route handlers (if you want to keep the API surface)

In Next.js 15 you can statically generate route handlers:

```ts
// app/api/quran/surah/[id]/[edition]/route.ts
export const dynamic = 'force-static';
export const revalidate = false;

export async function generateStaticParams() {
  const editions = ['en', 'ur', 'hi', 'roman'];
  return Array.from({ length: 114 }, (_, i) =>
    editions.map((edition) => ({ id: String(i + 1), edition }))
  ).flat();
}
```

⚠️ Move the edition into the **path**, not a query string — `force-static` handlers ignore search params and would cache a single variant for every translation.

---

### Phase 2 — Real URLs and pre-rendered pages (2–3 evenings)

`/surah/2` currently 404s. Creating it gives you deep links, SEO for 6,236 ayahs, and instant first paint.

```ts
// app/surah/[id]/page.tsx
export const dynamicParams = false;

export async function generateStaticParams() {
  return Array.from({ length: 114 }, (_, i) => ({ id: String(i + 1) }));
}

export default async function SurahPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ayahs = await getSurah(id);        // reads the local JSON — no network, no DB
  return <Reader initialAyahs={ayahs} surahId={id} />;
}
```

At build time Next pre-renders all 114 pages into static HTML. Repeat visitors and crawlers get text in the first response — no fetch waterfall, no spinner.

Add a sitemap with all 114 surah URLs (+ optionally per-surah parah pages). Your current sitemap has 3 URLs; that is costing you most of your organic traffic.

---

### Phase 3 — Schema normalisation and shrinking (1 evening)

Even though the DB leaves the read path, shrinking it still matters for tafseer/search and for staying inside the free plan. Full DDL is in **`schema-optimized.sql`**.

Key moves:

| Move | Why | Saving (est.) |
|---|---|---|
| Drop `arabic_tajweed` from the ayah table | It is a **second full copy** of the Arabic text; render tajweed colours client-side or store in a side table | **~2–3 MB** |
| Move `urdu`, `english`, `roman_urdu`, `hindi` out of the ayah row | A row should describe an ayah, not carry 4 translations. Cuts row width ~5× → far fewer pages scanned | **~6 MB**, 5× faster scans |
| `WITHOUT ROWID` + composite PK `(surah_id, ayah_no)` | Physically clusters a surah's ayahs together → one range scan = one contiguous read instead of a table scan | 10–50× fewer rows read |
| One `translations(edition, surah_id, ayah_no)` table instead of 25 tables | Uniform queries, one index, no schema churn per language | fewer pages |
| Drop unused editions | You expose **25 translations and 11 tafseers**; almost nobody switches beyond 2–3 | **~20–60 MB** |
| Move tafseer to static files or R2 | Tafseer is the real bulk (~100–150 MB) and is immutable | **~100 MB+** |
| `PRAGMA page_size = 4096`, then `VACUUM` | Reclaims free pages left by bulk loads/deletes | 10–30% |
| `ANALYZE` | Gives the planner row-count stats | prevents bad plans |
| Dedupe bismillah rows | 6,349 rows vs 6,236 ayahs = ~113 duplicated prefix rows | minor |

Target: **~150–250 MB → ~25–35 MB.**

---

### Phase 4 — Search that does not time out (1–2 evenings)

`/api/quran/search` currently **times out at 300 s**. `LIKE '%term%'` over every translation column of every ayah cannot work.

Two free options:

**Option A — Pagefind (recommended).** A static, client-side search index built at build time. Zero server, zero Turso, works offline, handles Arabic + Urdu + English with proper tokenisation. Run it after the JSON export:

```bash
npx pagefind --site public/data
```

**Option B — FTS5 in Turso.** Create a virtual table and query it with `MATCH` instead of `LIKE`:

```sql
CREATE VIRTUAL TABLE ayah_fts USING fts5(
  arabic, translation, edition UNINDEXED, surah_id UNINDEXED, ayah_no UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO ayah_fts (arabic, translation, edition, surah_id, ayah_no)
SELECT a.arabic, t.text, t.edition, a.surah_id, a.ayah_no
  FROM ayah a JOIN translation t USING (surah_id, ayah_no);
```

Note `remove_diacritics 2` — essential for Arabic, so `الرحمن` matches `الرَّحْمَٰن`.

---

## 6. Front-end fixes (Core Web Vitals)

### 6.1 Fonts — 408 KB → ~120 KB
- Replace the Google Fonts `<link>` with **`next/font/local`** (self-hosted, no 3rd-party render-blocking request — you are currently paying **2.0 s** for a 1.5 KB CSS file).
- Subset with `pyftsubset` to Arabic + Urdu + Latin ranges:
  ```bash
  pyftsubset NotoNaskhArabic-Regular.ttf \
    --unicodes="U+0020-007F,U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF" \
    --layout-features='*' --flavor=woff2 --output-file=naskh.woff2
  ```
- **Load Noto Nastaliq Urdu only on Urdu-content pages**, and only weight 400. Nastaliq is for Urdu prose; Quran Arabic needs Naskh only.
- Preload the one font used above the fold:
  ```tsx
  <link rel="preload" href="/fonts/naskh.woff2" as="font" type="font/woff2" crossOrigin="" />
  ```
- Keep `font-display: swap` to eliminate invisible-text time.

### 6.2 Stop sending the whole metadata blob
The homepage inlines all 114 surahs, 30 parahs, 25 translations and 11 tafseer definitions into the RSC payload. Split it:
- Ship only what the first screen needs (surah names).
- Fetch `meta/editions.json` on demand when the settings panel opens.
- Better: defer the parah list until the "parahs" tab is clicked.

### 6.3 Render ayahs in pages of 20
Do not fetch 286 ayahs before painting. Either stream from the static JSON or request `2.json` and render progressively — with static files this is nearly free, but on slow phones parsing 700 KB of JSON still blocks.

### 6.4 Add a service worker
Cache `/data/**` and `/fonts/**` with a cache-first strategy. Second visit to any surah becomes instant and works offline — a genuinely valuable feature for a Quran app.

### 6.5 Misc
- Add `next/image` for any raster art; use SVG for the logo (already done).
- Set `viewport` without `maximum-scale=1` (currently blocks pinch-zoom, an accessibility failure).
- The client bundle is 216 KB brotli — acceptable, but splitting the reader/tafseer/hadith routes with `next/dynamic` will help the homepage.

---

## 7. Verification checklist

### 7.1 Prove the query plan (do this first, 2 minutes)

```bash
turso db shell <your-db>
```
```sql
EXPLAIN QUERY PLAN SELECT * FROM quran WHERE surah = 2;
-- "SCAN quran"  → no index, this is your 25 seconds
-- "SEARCH quran USING INDEX …" → good
```

### 7.2 Measure where the bytes are

```sql
-- if dbstat is available
SELECT name, SUM(pgsize) / 1024 / 1024 AS mb
  FROM dbstat GROUP BY name ORDER BY mb DESC;
```
```sql
-- portable fallback
SELECT 'quran' AS t, COUNT(*) AS n,
       SUM(LENGTH(arabic) + LENGTH(arabic_tajweed) + LENGTH(urdu)
         + LENGTH(english) + LENGTH(roman_urdu) + LENGTH(hindi)) / 1048576.0 AS mb
  FROM quran;
```

### 7.3 Confirm the region fix
```bash
curl -sI "https://islam-pearl-zeta.vercel.app/api/quran/surah/1" | grep -i x-vercel-id
# want: bom1::bom1::…   (not bom1::iad1::…)
```

### 7.4 Confirm static serving
```bash
curl -sI "https://islam-pearl-zeta.vercel.app/data/surah/2/en.json"
# want: 200, x-vercel-cache: HIT, cache-control: …immutable
```

---

## 8. Free tier — the math

Turso **Free** plan ([pricing](https://turso.tech/pricing.md)): 5 GB storage, **500 M rows read/month**, 10 M rows written/month, 100 databases.

Rows read counts *every row scanned*, not rows returned — so an unindexed `WHERE surah = 2` on a 6,349-row table costs ~6,349 rows read **per view**.

| | Now | After |
|---|---|---|
| Rows read per surah view | ~6,000–25,000 (scan × N queries) | **0** (static) |
| Monthly page views supported by 500 M | **~20k–80k** | **unbounded** (no DB) |
| Timed-out searches | every `LIKE` search | eliminated |
| Storage | ~150–250 MB | ~25–35 MB |

You are nowhere near a paid plan after this change. The free tier is more than enough — you simply stop spending it on data that never changes.

---

## 9. Effort vs. impact

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | `regions: ["bom1"]` + move Turso DB to Mumbai | 15 min | 🔥🔥🔥 |
| 2 | Module-scope Turso client (stop per-request `createClient`) | 30 min | 🔥🔥🔥 |
| 3 | `s-maxage` + `stale-while-revalidate` on `/api/quran/*` | 30 min | 🔥🔥🔥 |
| 4 | `SELECT` only needed columns; drop `arabic_tajweed` from payload | 2 h | 🔥🔥🔥 |
| 5 | Add `(surah_id, ayah_no)` index / `WITHOUT ROWID` PK | 1 h | 🔥🔥 |
| 6 | Build-time JSON export → `/public/data` | 1 day | 🔥🔥🔥🔥 |
| 7 | Real `/surah/[id]` routes with SSG + sitemap | 1 day | 🔥🔥🔥 |
| 8 | Self-hosted subset fonts via `next/font` | 3 h | 🔥🔥 |
| 9 | Schema normalisation + `VACUUM` | 1 evening | 🔥🔥 |
| 10 | Pagefind (or FTS5) search | 1 evening | 🔥🔥 |
| 11 | Service worker offline cache | 2 h | 🔥🔥 |

**If you only do three things:** #1, #3, and #6. That is under a day of work and takes cold loads from ~25 s to under 100 ms.

---

## 10. What *not* to do

- ❌ **Don't add a bigger Turso plan.** The plan is not the bottleneck; the architecture is.
- ❌ **Don't add Redis / Upstash in front of Turso.** You would be caching data that should not be behind a network call at all.
- ❌ **Don't use `next/dynamic` or a spinner to hide the latency.** Fix the data path.
- ❌ **Don't store tafseer in the same `SELECT` as ayahs.** It is 10× the size and 99% of views never open it.
- ❌ **Don't keep 25 translations in the default response** to avoid a round trip. Ship per-edition files; the browser fetches exactly one.

---

## Appendix A — Diagnostic evidence (raw)

```
X-Vercel-Id: bom1::iad1::lvvx6-…        ← edge Mumbai, function US-East
X-Vercel-Cache: MISS                    ← cold every time
Cache-Control: public, max-age=86400    ← no s-maxage, no SWR

/api/quran/ayahs?surah=114&start=1&end=1&cb=test1   7742 ms   0.6 KB   MISS
/api/quran/ayahs?surah=1&start=1&end=1&cb=d74       4599 ms   0.7 KB   MISS
/api/hadith/books?cb=b72                            2023 ms   0.9 KB   MISS
/api/hadith/random?cb=c73                           8962 ms   1.2 KB   MISS
/api/quran/surah/1?tarjma=translation_english      25649 ms   4.7 KB   MISS
/api/quran/surah/2?tarjma=translation_english      24431 ms 699.8 KB   MISS
/api/quran/surah/18?tarjma=translation_english    165853 ms 186.5 KB   MISS
/api/quran/wordbyword?surah=2&ayah=255             90759 ms   3.7 KB   MISS
/api/quran/search?q=mercy                         504 @300 s
```

Response body for `surah/1?tarjma=translation_english` — note that four
translations plus a duplicate Arabic column are returned regardless of the
requested one:

```json
{"id":1,"surah":1,"para":1,"ayah":0,
 "arabic":"بِسْمِ اللَّهِ…",
 "arabic_tajweed":"بِسْمِ اللَّهِ…   ",
 "urdu":"شروع کرتا ہوں اللہ تعا لیٰ کے نام سے…",
 "english":"In the name of Allah, the Entirely Merciful…",
 "roman_urdu":"shuroo Allah kay naam say…",
 "hindi":"अल्लाह के नाम से जो बेइंतेहा मेहरबान…"}
```

## Appendix B — Files in this package

- `schema-optimized.sql` — normalised schema, indexes, FTS5, migration queries
- `implementation-snippets.md` — copy-paste code for every step above
