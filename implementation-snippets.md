# Implementation snippets — copy/paste

Ordered by the plan's phases. Each block is standalone.

---

## Phase 0 · `vercel.json`

```json
{
  "regions": ["bom1"],
  "functions": {
    "app/api/**/*": {
      "maxDuration": 30
    }
  }
}
```

> `bom1` = Mumbai (closest Vercel region to Pakistan/India). Default is `iad1`
> (Washington DC) — that alone is ~250 ms per database round trip.
>
> Also move the Turso database to **`aws-ap-south-1`** in the Turso dashboard.

---

## Phase 0 · Reuse one Turso client

`lib/db.ts`

```ts
import { createClient } from '@libsql/client/web';

if (!process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL missing');

/**
 * Module scope: one client per warm serverless instance.
 * Creating a client inside the handler re-does TLS + auth on every
 * request — that is the ~2 s floor we measured on cold endpoints.
 */
export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

---

## Phase 0 · Cached route handler, minimal columns

`app/api/quran/surah/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Immutable content: cache hard at the edge, serve stale instantly.
const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=2592000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const surahId = Number(id);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    return NextResponse.json({ error: 'Invalid surah' }, { status: 400 });
  }

  const edition = req.nextUrl.searchParams.get('tarjma') ?? 'en_saheeh_intl';

  // One query, one range scan, only the columns the UI renders.
  const rs = await db.execute({
    sql: `
      SELECT a.ayah_no,
             a.arabic,
             t.text AS translation
        FROM ayah a
        LEFT JOIN translation t
               ON t.surah_id = a.surah_id
              AND t.ayah_no  = a.ayah_no
              AND t.edition  = ?
       WHERE a.surah_id = ?
       ORDER BY a.ayah_no
    `,
    args: [edition, surahId],
  });

  return NextResponse.json(rs.rows, {
    headers: {
      'Cache-Control': CACHE,
      // Vercel-specific: makes the CDN ignore `max-age` and keep it longer
      'CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
```

Before/after for `surah=2`: **700 KB → ~120 KB** raw (~30 KB brotli), and
**`SCAN` → `SEARCH`** in the query plan.

---

## Phase 1 · Export the corpus to static JSON

`scripts/export-quran.ts` (run in CI or before `next build`)

```ts
import { db } from '../lib/db';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'data');

async function writeJson(file: string, data: unknown) {
  const full = path.join(OUT, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(data));
  console.log('wrote', file, (JSON.stringify(data).length / 1024).toFixed(1), 'KB');
}

async function main() {
  // --- metadata (small, fetched once per session) ---
  const surahs = await db.execute(
    `SELECT id, name_ar, name_en, name_translit, ayah_count, revelation, para_start
       FROM surah ORDER BY id`
  );
  await writeJson('meta/surahs.json', surahs.rows);

  const parahs = await db.execute(
    `SELECT id, name_ar, start_surah, start_ayah, end_surah, end_ayah
       FROM parah ORDER BY id`
  );
  await writeJson('meta/parahs.json', parahs.rows);

  const editions = await db.execute(
    `SELECT key, kind, label, lang, is_rtl FROM edition WHERE enabled = 1 ORDER BY kind, lang`
  );
  await writeJson('meta/editions.json', editions.rows);

  // --- per-surah, per-edition text ---
  // Short keys: this data is shipped 6,236 times.
  for (let s = 1; s <= 114; s++) {
    const ayahs = await db.execute({
      sql: `SELECT ayah_no, arabic FROM ayah WHERE surah_id = ? ORDER BY ayah_no`,
      args: [s],
    });
    await writeJson(
      `surah/${s}/ar.json`,
      ayahs.rows.map((r) => ({ a: r.ayah_no, ar: r.arabic }))
    );
  }

  for (const ed of editions.rows) {
    if (ed.kind !== 'translation') continue;
    for (let s = 1; s <= 114; s++) {
      const rows = await db.execute({
        sql: `SELECT ayah_no, text FROM translation
               WHERE edition = ? AND surah_id = ? ORDER BY ayah_no`,
        args: [ed.key, s],
      });
      if (!rows.rows.length) continue;
      await writeJson(
        `surah/${s}/${ed.key}.json`,
        rows.rows.map((r) => ({ a: r.ayah_no, t: r.text }))
      );
    }
  }

  // --- tafseer: one file per edition per surah, loaded on demand ---
  const taf = await db.execute(`SELECT key FROM edition WHERE kind = 'tafseer' AND enabled = 1`);
  for (const { key } of taf.rows as any[]) {
    for (let s = 1; s <= 114; s++) {
      const rows = await db.execute({
        sql: `SELECT ayah_no, text FROM tafseer
               WHERE edition = ? AND surah_id = ? ORDER BY ayah_no`,
        args: [key, s],
      });
      if (!rows.rows.length) continue;
      await writeJson(`tafseer/${key}/${s}.json`, rows.rows);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`package.json`

```json
{
  "scripts": {
    "export:data": "tsx scripts/export-quran.ts",
    "build": "npm run export:data && next build"
  }
}
```

---

## Phase 1 · Long-lived cache headers for the data files

`next.config.ts`

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/data/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default config;
```

---

## Phase 1 · Client: fetch the static file instead of the API

```ts
// lib/quran.ts
export type Ayah = { a: number; ar: string; t?: string };

const cache = new Map<string, Promise<Ayah[]>>();

/** De-duplicated, memoised fetch of one surah + edition. */
export function loadSurah(surah: number, edition: string) {
  const key = `${surah}/${edition}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`/data/surah/${surah}/${edition}.json`).then((r) => {
        if (!r.ok) throw new Error(`surah ${surah} ${edition}`);
        return r.json();
      })
    );
  }
  return cache.get(key)!;
}
```

The component change is one line — replace:

```ts
const res = await fetch(`/api/quran/surah/${surah}?tarjma=${edition}`);
```

with:

```ts
const rows = await loadSurah(surah, editionKey);
```

> Keep `arabic` in `ar.json` and the translation in its own file so switching
> translation never re-downloads the Arabic.

---

## Phase 2 · Real, pre-rendered surah pages

`app/surah/[id]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Reader from '@/components/Reader';

export const dynamicParams = false;

export async function generateStaticParams() {
  return Array.from({ length: 114 }, (_, i) => ({ id: String(i + 1) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surahs = JSON.parse(
    await readFile(path.join(process.cwd(), 'public/data/meta/surahs.json'), 'utf8')
  );
  const s = surahs.find((x: any) => x.id === Number(id));
  return {
    title: s ? `Surah ${s.name_en} — Quran Web` : 'Quran Web',
    alternates: { canonical: `/surah/${id}` },
  };
}

export default async function SurahPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (n < 1 || n > 114) notFound();

  const base = path.join(process.cwd(), 'public/data/surah', String(n));
  const arabic = JSON.parse(await readFile(path.join(base, 'ar.json'), 'utf8'));

  // Server-render the Arabic so the first paint has real text.
  return <Reader surahId={n} initialArabic={arabic} />;
}
```

`app/sitemap.ts`

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://islam-pearl-zeta.vercel.app';
  const now = new Date();
  return [
    { url: base, lastModified: now, priority: 1 },
    ...Array.from({ length: 114 }, (_, i) => ({
      url: `${base}/surah/${i + 1}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    })),
  ];
}
```

Your sitemap currently lists **3 URLs**; this makes 6,236 ayahs indexable.

---

## Phase 3 · Self-hosted fonts

`app/layout.tsx`

```tsx
import localFont from 'next/font/local';

const naskh = localFont({
  src: [
    { path: '../public/fonts/naskh-regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/naskh-bold.woff2',    weight: '700', style: 'normal' },
  ],
  variable: '--font-naskh',
  display: 'swap',
  preload: true,
});

// Load Nastaliq ONLY where Urdu prose is rendered, not app-wide.
const nastaliq = localFont({
  src: '../public/fonts/nastaliq-regular.woff2',
  variable: '--font-nastaliq',
  display: 'swap',
  preload: false,
});
```

Subset command:

```bash
pip install fonttools brotli
pyftsubset NotoNaskhArabic-Regular.ttf \
  --unicodes="U+0020-007F,U+00A0,U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF" \
  --layout-features='*' --flavor=woff2 \
  --output-file=public/fonts/naskh-regular.woff2
```

Expected: **408 KB → ~110–140 KB**, and the 2.0 s render-blocking
`fonts.googleapis.com` request disappears from the critical path.

---

## Phase 4 · Service worker (offline + instant repeat visits)

`public/sw.js`

```js
const CACHE = 'quran-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/data/meta/surahs.json'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isStatic =
    url.pathname.startsWith('/data/') || url.pathname.startsWith('/fonts/');

  if (isStatic) {
    // Cache-first: immutable content, never changes.
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
      )
    );
  }
});
```

---

## Phase 4 · Static search with Pagefind

```bash
npm i -D pagefind
```

`package.json`

```json
{
  "scripts": {
    "build": "npm run export:data && next build && pagefind --site .next/standalone/public"
  }
}
```

Or, simplest, keep the generated JSON under `public/data` and index that:

```bash
npx pagefind --site public/data --output-subdir /pagefind
```

Then in the search box:

```ts
const pagefind = await import('/pagefind/pagefind.js');
const search = await pagefind.search(query);
const results = await Promise.all(search.results.slice(0, 20).map((r) => r.data()));
```

This removes the `/api/quran/search` endpoint — the one that currently
**times out at 300 seconds**.

---

## Verification commands

```bash
# region must be bom1::bom1
curl -sI https://islam-pearl-zeta.vercel.app/api/quran/surah/1 | grep -i x-vercel-id

# static data must be immutable + HIT
curl -sI https://islam-pearl-zeta.vercel.app/data/surah/2/en_saheeh_intl.json | grep -iE 'cache|age'

# one query, one range scan
turso db shell <db> "EXPLAIN QUERY PLAN SELECT * FROM ayah WHERE surah_id = 2"
```
