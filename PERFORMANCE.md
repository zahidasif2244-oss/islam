# Quran Web — Performance Overhaul (Nov 2026)

Goal: **30–60 second loads → instant.** This document records what was measured,
what was actually broken, what changed, and how to keep it fast.

---

## 1. The diagnosis (measured against the live site)

| What was measured | Result |
|---|---|
| Homepage HTML | 88.9 KB, edge-cached |
| `alvi_nastaleeq.woff2` | **5,228,740 bytes** |
| `jameel_noori_nastaleeq.woff2` | **5,554,840 bytes** |
| Google Fonts stylesheet | render-blocking, 3rd-party, ~2 s |
| `/api/quran/surah/114` (4.3 KB answer) | **22.9 s** TTFB (cold) |
| `/api/quran/surah/3` | **24.7 s** TTFB |
| `/api/quran/surah/2`, `/surah/18`, `/surah/55`, `/parah/1` | **never answered** (90 s timeout) |
| `/api/books` | **> 45 s** timeout |
| `/api/quran/wordbyword` | **11 s** |
| `x-vercel-id` | `bom1::iad1` → function ran in **US-East** for Pakistan/India users |

### Why the API was that slow

Next.js traces every file a route reads into that route's serverless bundle.
`src/lib/baked.ts` resolved data with a **dynamic path**
(`path.join(process.cwd(), 'src', 'data', <variable>)`), so the tracer could not
know which file was needed and included the whole directory:

```
/api/quran/surah/[id]      → 475.7 MB bundle   (487 files)
/api/quran/ayahs           → 475.7 MB bundle
/api/hadith/book/[id]      → 330.2 MB bundle   (all 17 books)
/api/websites              → 210.8 MB bundle   (fs.readdir on public/)
```

Every cold request had to download and unpack that archive **before** running a
handler that only needed a few KB. That is the whole 20–25 s, and the reason
some requests never completed. It was never a database problem — most of that
data was already baked into JSON.

### Why the page still felt slow *after* the API answered

10.8 MB of woff2 fonts (Alvi + Jameel Nastaliq) plus a render-blocking Google
Fonts request. On a 1–2 Mbps mobile link that alone is **45–90 seconds** of
network time, and it starves every other request.

---

## 2. What changed

### 2.1 Fonts: 10.8 MB → 0.23 MB

* Removed the Google Fonts `<link>` (no more 3rd-party render-blocking request).
* Replaced Alvi Nastaleeq (5.2 MB) and Jameel Noori (5.5 MB) with **Noto
  Nastaliq Urdu** — a real Nastaliq face, self-hosted, **159 KB**.
  * Subsetting Alvi was tried first: it has 16,982 glyphs and the layout
    closure keeps ~all of them, so even a 365-character subset stayed at
    5.1 MB. Subsetting was abandoned; a lighter Nastaliq was used instead.
* Quran Arabic still uses **NooreHuda** (70 KB), preloaded above the fold.
* Urdu Nastaliq is **not** preloaded — it is fetched by CSS only when Urdu text
  actually renders (`document.fonts` shows `Nastaliq:loaded` after opening a
  surah, `unloaded` on the homepage).
* Both fonts are served `Cache-Control: immutable` for a year.

The old files remain in `public/fonts/` (unreferenced) in case you want to go
back; deleting them saves ~21 MB per deployment.

### 2.2 Content off the serverless path, onto the CDN

`scripts/export-static-data.mjs` (runs in `npm run build`) turns `src/data`
into immutable static files under `public/data`:

```
public/data/quran/<surah>/ar.json          { p:[para], y:[ayah], s:[surah], a:[arabic] }
public/data/quran/<surah>/tr-<column>.json [ translation text per ayah ]
public/data/quran/parah/<n>/...            same shape, for the 30 parahs
public/data/quran/tafseer/<surah>/<col>.json   { "1": "text", … }
public/data/quran/wbw/<surah>.json         word-by-word
public/data/quran/awords/<surah>.json      arabic word analysis
public/data/static/*.json                  surahs, parahs, topics, duas, books, search index…
```

2,768 files / ~160 MB on disk — served by Vercel's CDN, **zero function invocations**,
`max-age=31536000, immutable` for the Quran corpus.

The client reads them through `src/lib/quran-static.ts`, whose return shapes are
identical to the old API, so almost no component code had to change. The
`api()` helper in `quran-app.tsx` now routes each path to either a static file
or one of the few remaining server endpoints.

Measured transfer for Al-Baqarah (286 ayahs): **24.7 KB + 22.6 KB gzipped**
(previously a 700 KB single response produced after 24 s).

### 2.3 Every function bundle shrank by 90–98 %

* Deleted the content routes that are now static (surah, parah, ayahs,
  word-by-word, arabic-words, tafseer-by-ayah, surah-tafseer, search,
  search-text, all the baked-list routes, duas, books, websites).
* **Hadith is now one function per book** (`scripts/gen-hadith-routes.mjs`
  generates `src/lib/hadith-data/<book>.ts` + `src/app/api/hadith/<book>/route.ts`).
  A cold start loads only that book (4–44 MB) instead of all 17 (320 MB).
  The client keeps its old URLs; `api()` maps them to `?action=page|number|search|one`.
* **Tafseer search** no longer carries the 90 MB corpus: it pulls the per-surah
  static files from the CDN on first use and memoises them per instance.
* `/api/websites` no longer walks `public/` at runtime (that traced 210 MB of
  files into the function); the child-site list is baked to `sites.json`.
* `ensureIndexes()` (90 DDL statements across 18 databases on every cold start)
  is now opt-in: set `ENSURE_INDEXES=1` only for a brand-new database.

Resulting bundle sizes:

| Route | Before | After |
|---|---|---|
| `/api/quran/surah/[id]` | 475.7 MB | *removed (static file)* |
| `/api/hadith/*` | 330.2 MB | **14.9 – 54.8 MB** (per book) |
| `/api/quran/tafseer/search` | 475.7 MB | **10.6 MB** |
| `/api/websites` | 210.8 MB | *removed (static file)* |

### 2.4 Region + caching

* `vercel.json` → `"regions": ["bom1"]` (Mumbai). Functions were executing in
  `iad1` (Washington DC) for a Pakistan/India audience.
* `lib/api-utils` responses and every static file are cached at the edge;
  hadith pages/immutable content use `s-maxage` + `stale-while-revalidate`.
* Quran search now runs **in the browser** over the pre-normalised index
  (`/data/static/search-index.json`, 2.6 MB gzipped, cached for a year), so a
  keystroke costs no network round trip.
* The Books tab paints from `/data/books.json` immediately and only waits
  450 ms for the optional Turso overlay (`/api/books/overrides`) — a slow
  database can never block the grid again.

---

## 3. Results — measured on the **live** site (headless Chrome, 390×844, from Karachi)

| Interaction | Before (live, old deployment) | After (live, current deployment) |
|---|---|---|
| Page load (HTML + JS + font) | 30–60 s on mobile data | **3.4 s** cold, instant on repeat |
| Open Surah 1 | 4.6 – 25 s | **0.53 s** |
| Open Al-Baqarah (287 ayahs) | 24 s – 166 s, often no response | **0.34 s** |
| Books tab (2,471 books) | **60 s+ / timeout** | **0.55 s** |
| Duas tab | 0.4 – 0.6 s | **0.42 s** |
| Hadith tab | 2 – 20 s | **1.34 s** (cold function) |
| Word-by-word | 11 – 90 s | **0.79 s** |
| Quran search (first / next) | 54 s / timeout | **2.2 s / instant** |
| Tafseer search (first / next) | 20 s + | **2.2 s / instant** |

Verified with `node scripts/smoke-test.mjs https://islam-pearl-zeta.vercel.app`
— it clicks through every tab on the real deployment and reports **0 console
errors, 0 failed requests**.

Earlier local-build numbers (before the deploy/tafseer/books fixes) were
163 ms for a surah and 642 ms for Books; the live numbers above are the ones
that matter and include real cold starts and the Karachi→Mumbai RTT.

---

## 3.1 Why the first push did not change the live site

The rewrite was committed and pushed at 10:53, yet the site kept serving the old
(60-second) build. A failed Vercel build **does not take the site down** — it
keeps the previous deployment serving traffic, so everything looks normal.

The build was failing on `scripts/bake-static-data.mjs`: that step talks to
Turso, and when the database is unreachable it called `process.exit(1)`.
Deployment builds no longer touch the database at all:

```
build       = build-books-data -> export-static-data -> next build   (no DB, no network)
build:full  = static:sync -> export-static-data -> next build        (local refresh)
```

Always confirm a deploy actually shipped before believing a fix:

```bash
curl -sI https://islam-pearl-zeta.vercel.app/data/quran/2/ar.json | head -1   # 200 = live
```

---

## 4. Maintaining it

```bash
npm run data:export     # regenerate public/data from src/data (part of build)
npm run static:sync     # refresh src/data from the database (developer machine only)
npm run build:full      # static:sync + data:export + next build (local refresh)
npm run hadith:routes   # regenerate the 17 per-book hadith loaders + routes
npm run build           # what Vercel runs: books sync -> data export -> next build
```

**The deployment build never touches the database.** `src/data/**` is committed
and is the source of truth for Vercel; `npm run build` only reshapes it into
`public/data`. Refreshing the corpus from Turso is a separate, deliberate step
(`npm run static:sync` / `npm run build:full`) that you run locally and commit.

This matters: the build used to run the database bake in CI, and when the
database was unreachable that step exited non-zero. Vercel then **kept the
previous deployment live**, so the site silently stayed on old code even though
the commit was on GitHub.

* `public/data/` is **generated and git-ignored** — never commit it.
* `public/fonts/noto-nastaliq-urdu.woff2` **must be committed** (it is the app font).
* When adding a hadith book: drop `src/data/hadith/<book>.json`, add it to
  `BOOK_NAMES` in `src/lib/constants.ts`, run `npm run hadith:routes`.
* When adding a translation/tafseer column: add it to the list at the top of
  `scripts/export-static-data.mjs` (and `src/lib/constants.ts`), then rebuild.
* Deployment: push to GitHub → Vercel builds → `public/data` is produced during
  the build and uploaded to the CDN. **Verify the deploy actually shipped** —
  see §5; a failed build leaves the old deployment serving traffic.

---

## 5. Verify the deployment

### 5.1 Did the new code actually ship?

A failed Vercel build keeps the **previous** deployment serving traffic, so the
site looks unchanged and nobody notices. One request settles it:

```bash
curl -sI https://islam-pearl-zeta.vercel.app/data/quran/2/ar.json | head -1
# 200 → new build is live
# 404 → Vercel is still serving the old deployment (rebuild required)
```

### 5.2 Then check region + caching

```bash
# functions run in Mumbai now (bom1::bom1, not bom1::iad1)
curl -sI https://islam-pearl-zeta.vercel.app/api/hadith/bukhari?action=page | grep -i x-vercel-id

# corpus is immutable and CDN-cached
curl -sI https://islam-pearl-zeta.vercel.app/data/quran/2/ar.json | grep -iE 'cache-control|x-vercel-cache'
# → cache-control: public, max-age=31536000, immutable

# Al-Baqarah Arabic is ~25 KB gzipped and served with no function
curl -s --compressed -o /dev/null -w '%{size_download} bytes\n' \
  https://islam-pearl-zeta.vercel.app/data/quran/2/ar.json
```

If `/data/...` comes back with `max-age=0, must-revalidate` on Vercel, the
`headers()` block in `next.config.js` did not apply — the files still work, but
add the cache header in the Vercel dashboard (Project → Headers) for
`/data/quran/*` and `/fonts/*`.

---

## 6. Still on the table (not blocking)


1. **Tafseer search cold path** — the first search on a fresh function instance
   pulls 114 small files (~0.5–1.5 s) before it is memoised. Pre-building one
   combined file per column would trade +90 MB of static assets for ~0.3 s.
2. **First search index download** — 2.6 MB gzipped. Could be halved by
   computing the Arabic-normalised and Urdu-encoded forms in the browser.
3. **Big hadith books** (`beyhaqi` 55 MB, `musnad`, `alzawaid`) — a cold start
   still parses 20–40 MB of JSON. Splitting them into pages would make them
   static, at the cost of ~280 MB of generated files.
4. **The unused Alvi/Jameel fonts** (21 MB) can be deleted from `public/fonts/`.
5. `/sitemap.xml` still lists 3 URLs — real `/surah/[id]` routes would make
   6,236 ayahs indexable (SEO, not speed).
