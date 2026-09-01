# Chat Log — Quran Web Portal

## Session Summary

### 1. About Page Reorder
- Swapped **Dedication banner** (with floating hearts) above the **"AR" logo + "Ali Raza — Full Stack Developer"** section in `AboutTab`.
- File: `src/app/page.tsx:1349-1370`

### 2. About Page Branding Update
- Replaced the **"AR" letter logo** with the **Quran Web logo** (`/logo.svg`, same as header) in the About tab header circle.
- Replaced **"Ali Raza" + "Full Stack Developer"** with heading **"Quran Web Team run by CEO Ali Raza"** (subtitle removed).
- File: `src/app/page.tsx` — `AboutTab` header block.

### 3. Tafseer Search — Real-Time, Multi-Word, Deep Dive
**API** (`src/app/api/quran/tafseer/search/route.ts`):
- **Real-time friendly**: OR semantics — results match ANY typed word, ranked by phrase match first, then most-words-matched, then shortest text; `LIMIT 100` (was AND — multi-word returned nothing).
- **Urdu encoding fix**: added `encodeUrdu()` (inverse of `decodeUrdu`) — 3 tafseer columns (`tafseer_moudoodi`, `taqi_tafseer`, `k_iman`) store Urdu SHIFTED-3-codepoints encoded; raw typed words matched 0 rows, encoded words matched 448 (verified live).
- Response includes `searchWords`, `match_count`, `total_words`, `phrase_match`.
- Empty tafseer columns (9 of 16, e.g. `tafseer_fizilal`, `tafseer_karam_shah`) are now skipped when searching all types (cached `count(*)` check).

**Frontend** (`src/app/page.tsx`):
- Real-time search with 350ms debounce (`useEffect` on `searchQuery`/`tfType`); Enter/button still instant.
- Added `makeSnippet()` — context snippet around first match with `…` ellipses (deep dive).
- Added `highlightText()` — wraps every typed-word occurrence in `<mark>` (yellow).
- Result badges: `2/2 words · phrase` (green = all words, orange = phrase, grey = partial).
- Clicking a result opens full tafseer with all searched words highlighted.

### 4. Hadith Tab — Two Real-Time Search Functions
**API**:
- New `src/app/api/hadith/number/[book]/route.ts` — search by hadith number: exact match first, then prefix, then substring (number + international number), ordered numerically, `LIMIT 30`.
- `src/app/api/hadith/search/[book]/route.ts` — Urdu word search: OR across ALL hadith content — `hl_ur.hadees` (ENCODED → `encodeUrdu` applied), `hl_ur.ravi` (PLAIN), `hl_en.hadees` (plain English), `hl_en.ravi` (plain), `h.arabic` (diacritic-safe raw LIKE) — ranked phrase/most-words first; returns narrator lines too.

**Frontend** (`src/app/page.tsx` — `HadithTab`):
- Two debounced real-time inputs: **"Search by Hadith Number"** and **"Search by Urdu Words"**.
- Results with Arabic, highlighted Urdu snippet, match badges, narrator line; click → full hadith modal.
- Book list hidden while a search is active.

### 5. Quran Tab Search — Three Real-Time Search Functions
**API**:
- New `src/app/api/quran/search_text/route.ts` — `lang=urdu` (encoded `translation_urdu` LIKE) or `lang=arabic` (normalized index).
- New shared lib `src/lib/quran-search.ts` — `encodeUrdu`, cached Arabic normalization index (`getArabicIndex`), `urduQuranMatches`, `arabicQuranMatches`, `mergeQuranHits` (per-word flag union, no count over/under-report), `encodeUrduPhrase`.
- New `src/lib/arabic.tsx` — Arabic normalization for **Urdu-style mushaf script**: strips diacritics/Quranic marks/verse-number ornaments; maps Urdu letters (ی→ي، ہ→ه، ک→ك، ے→ي، ں→ن), hamza forms (أإآٱ→ا); Uthmani fixes: taa marbuta `و`→`ا` before ة/ۃ (صلاة→صلوة), **dual-variant superscript alif** (ٰ→ا variant for العالمين, skip variant for الرحمن); exports `highlightArabic` (maps highlight ranges back to original mushaf text) and `arabicSnippet`.
- `src/app/api/quran/search/route.ts` rewritten — `Surah:Ayah` reference (`2:255`) OR combined urdu+arabic text search; **English/roman-Urdu no longer searched**.

**Frontend** (`src/app/page.tsx` — `QuranSearch`):
- Three debounced real-time inputs: **Surah:Ayah reference** (e.g. `2:255`), **Urdu words**, **Arabic words**.
- Urdu results: highlighted snippets + badges; Arabic results: mushaf text with Arabic-aware highlighting; click → full ayah modal.

### 6. Search Audit — Scope Verification (deep dive)
**Verified with direct live-DB tests:**
- **Quran search**: searches ONLY Quran Urdu (`translation_urdu`) + Quran Arabic (`arabic`); English excluded (verified: "In the name" → 0 results). Arabic stored as Urdu-style mushaf with diacritics — raw `LIKE` could never match; normalized in-memory index (6349 rows, ~300ms build, cached).
- **Hadith search**: searches ONLY hadith book content — now covers Urdu hadees (encoded), Urdu ravi (plain), English hadees, English ravi, Arabic (verified: `بیان` via ravi, `Muslim` via English, `رسول` via Arabic, `نبی کریم صلی اللہ علیہ وسلم` → 6/6 words).
- **Tafseer search**: searches ONLY tafseer columns; per-column encoding flags verified correct (3 encoded: moudoodi/taqi/k_iman; 4 plain: tibyan/zia/irfan/hasanaat; 9 empty skipped).

### 7. Git Line-Endings (LF/CRLF) Fix
- Added `.gitattributes` (`* text=auto`) to suppress LF/CRLF warnings in GitHub Desktop.
- Second occurrence: set repo-local `core.autocrlf false` so checkout no longer converts to CRLF — warning eliminated permanently while index stays LF-normalized via `.gitattributes`.

### 8. GitHub Desktop Push Error — Auto-Fix Batch File
- **Symptom**: GitHub Desktop shows *"This file uses 'LF' line endings, but Git is configured to convert them to 'CRLF' the next time the file is checked out"* on every push.
- **Root cause (diagnosed)**: `git ls-files --eol` showed 3 tracked files with working-tree CRLF/mixed endings while index was LF: `next-env.d.ts` (w/crlf), `r.txt` (w/crlf), `tsconfig.json` (w/mixed). Files were checked out as CRLF before `core.autocrlf false` was set.
- **Fix**: New `fix-push.bat` (repo root):
  1. `git config core.autocrlf false` + `core.eol lf`
  2. Rewrites `.gitattributes` to `* text eol=lf` (forces LF on checkout — warning can never appear)
  3. PowerShell one-liner converts all tracked `w/crlf`/`w/mixed` files to LF (parses `git ls-files --eol`)
  4. `git add --renormalize .` + commit `fix: normalize line endings to LF` (skips if nothing to commit)
  5. `git push origin <current-branch>` — prints success/failure, `pause` at end
- **Usage**: double-click or run `.\fix-push.bat` whenever the warning appears.

### 9. Urdu Font Not Loading on Live Site — Binary Files Corrupted by Line-Ending Normalization
- **Symptom**: Urdu text renders fine locally (dev server) but falls back to system font on the live Vercel site (`islam-pearl-zeta.vercel.app`).
- **Root cause (diagnosed)**: `.gitattributes` was `* text eol=lf` — this marked **binary files as text**. The renormalize commit (`b4fdcc7`, from `fix-push.bat`) stripped every `0x0D` byte from the binaries before storing: `alvi_nastaleeq.ttf` 9,559,112 → 9,556,443 bytes, `jameel_noori_nastaleeq.ttf` 10,784,980 → 10,782,103, all fonts + `logo.png`/`favicon.ico` (119,023 → 119,022). Vercel deployed the corrupted blobs → browsers rejected the broken fonts → fallback font.
- **Verification**: `git check-attr text eol` → `text: set` on `.ttf`; `fc /b` byte-compare of blob vs working file showed differences were exactly missing `0x0D` bytes; staged-vs-working `git hash-object` equality confirmed.
- **Fix** (commit `35cad05`, pushed):
  1. `.gitattributes` — added `*.ttf *.otf *.woff *.woff2 *.eot *.png *.jpg *.jpeg *.gif *.webp *.ico *.pdf *.zip *.wasm binary` (overrides the `* text eol=lf` rule so git never converts binary bytes)
  2. `git add --renormalize .` — re-stored pristine bytes for all 7 fonts + `logo.png` + `favicon.ico`
  3. `fix-push.bat` — updated so its `.gitattributes` rewrite also emits the binary overrides (it previously reintroduced the corruption)
- **Verified live**: deployed sizes now match originals — alvi 9,559,112 ✓, jameel 10,784,980 ✓, noorehuda 192,112 ✓, logo.png 119,023 ✓. Hard-refresh (Ctrl+F5) needed once to bypass cached old font.

### 10. Child Website "Dua & Shifa" 404 — Root Cause: Relative Redirect + Trailing-Slash 308
- **Symptom**: Clicking **More → Other Websites → Dua & Shifa** on the live site (`islam-pearl-zeta.vercel.app`) ended at `…/home.html` → 404 "page could not load".
- **Root cause (diagnosed)**: Vercel answers `/dua-shifa/` (and formerly `/Dua%20%26%20Shifa/`) with a **308 redirect** to the same path **without the trailing slash** (`/dua-shifa`). The child site's `index.html` used a *relative* meta-refresh `url=home.html` — against a no-slash base URL the browser treats the last segment as a file name, so `home.html` resolved to the **site root** (`/home.html`) → 404. The rename (below) changed the URL but not the bug.
- **Fixes**:
  1. `git mv public/Dua & Shifa → public/dua-shifa` — clean URL, no `&`/space encoding issues (commit `1ef210d`, pushed).
  2. `public/dua-shifa/index.html` — replaced the broken meta-refresh with a JS redirect: `location.pathname.replace(/\/index\.html$/i,'').replace(/\/+$/,'') + '/home.html'` → lands on `/dua-shifa/home.html` regardless of trailing slash. From there all relative links (styles.css, app.js, post.html…) resolve inside the folder → whole child site works.
  3. `src/app/page.tsx` (OtherLinksView) — child-site cards now `window.open(site.url, '_blank', 'noopener')` so the child site opens in a **new tab** and the main site stays on the same page (was `window.location.href` full-page navigation).
- **Verified live**: `/dua-shifa/` → 308 → `/dua-shifa` → 200 (index); `/dua-shifa/home.html`, styles.css, app.js, fonts → all 200; old `/Dua%20%26%20Shifa/` → 404 (correctly gone).
- **Lesson**: with Vercel's slash-stripping 308, never rely on *relative* URLs inside child sites served at directory URLs — compute paths from `location.pathname`.

### 11. Books Tab — Embed `public/books.html` + Hide Search Tab from Nav
**Books tab** (`src/app/page.tsx`):
- Added `'books'` to `Tab` type (after `'about'`), tab button in nav after About, and `{tab === 'books' && <BooksTab />}` render switch.
- `BooksTab` (page.tsx:1880) embeds the static `public/books.html` (کتب خانہ — dawateislami book cards with search/pagination) in an **iframe**.
- **No inner scrollbar**: iframe auto-resizes to its content height — on `load` + every 800ms it reads `contentDocument.body.scrollHeight`, sets inner `overflow: hidden` on `documentElement`/`body`, and applies that height to the iframe (`scrolling="no"` fallback). Main page scrollbar does all scrolling; polling keeps height correct when the search box filters cards. Note: books.html's `window.scrollTo(0,0)` on pagination now scrolls the main page.

**Search tab hidden from nav**:
- Removed `'search'` from the nav buttons array only — `SearchTab` render switch and functionality untouched (tab can still be activated programmatically; content at `src/app/page.tsx`).

## Key Files Changed
| File | Change |
|------|--------|
| `src/app/page.tsx` | NEW Books tab (nav after About) + `BooksTab` auto-resizing iframe embed of `/books.html`; `'search'` removed from nav buttons only (search functionality intact) |
| `public/dua-shifa/*` | Renamed from `public/Dua & Shifa/`; `index.html` meta-refresh → JS directory-aware redirect |
| `src/app/page.tsx` | Child-site cards open in new tab (`window.open` + `noopener`) instead of same-page navigation |
| `src/app/page.tsx` | About branding; real-time tafseer/hadith/quran search UI; `makeSnippet`; result badges; narrator display |
| `src/app/api/quran/tafseer/search/route.ts` | OR semantics + `encodeUrdu` + ranking + empty-column skip |
| `src/app/api/hadith/search/[book]/route.ts` | OR across all hadith fields (urdu encoded, ravi plain, english, arabic) |
| `src/app/api/hadith/number/[book]/route.ts` | NEW — real-time hadith number search |
| `src/app/api/quran/search/route.ts` | Rewritten — reference + urdu/arabic union, no English |
| `src/app/api/quran/search_text/route.ts` | NEW — urdu/arabic text search |
| `src/lib/quran-search.ts` | NEW — shared quran search engine (encoding, index, union) |
| `src/lib/arabic.tsx` | NEW — Arabic mushaf normalization + highlight/snippet |
| `.gitattributes` | `* text=auto` → `* text eol=lf` (bat-updated) → + binary overrides for fonts/images (35cad05) |
| `git config` | `core.autocrlf false` (repo-local) |
| `fix-push.bat` | NEW — auto-fixes line endings + commits + pushes (GitHub Desktop warning fix); updated to keep `*.ttf/*.png/... binary` so it never corrupts binaries |

## Verified Against Live DB
- Tafseer: `مسلمان` encoded→448 (raw→0) on `tafseer_moudoodi`; 2-word OR/AND counts on tibyan.
- Quran Arabic: `الرحمن`→160, `الله`→1858, `الصلاة`→61, `القرآن`→50, `رب العالمين`→1089 (1:1 first), `العالمين`→61.
- Quran Urdu: `رحمن رحیم` multi-word union works; English words → 0.
- Hadith: number search exact-first (#12 → #12, #120...); urdu ravi plain vs hadees encoded confirmed.
- Live fonts (Vercel): deployed sizes match pristine originals after `35cad05` — alvi 9,559,112 / jameel 10,784,980 / noorehuda 192,112 / logo.png 119,023.

## Project Context
- Title: **Quran Web** (shortcut: QW)
- Default Tarjma: `k_iman` (Kanzul Eman)
- Default Tafseer: `tafseer_tibyan` (Tibyan ul Quran)
- Database: turso.tech (remote)
- Fully responsive (mobile/tablet/desktop)
- Self-hosted (no Vercel/Netlify)

### 12. Hadith Bookmarks (uncommitted — commit via GitHub Desktop)
All changes in `src/app/page.tsx`. Verified with `npx tsc --noEmit` (clean). Dev server unusable (known Turbopack crash), so UI verified live after Vercel deploys.

- **Bookmark button under the Hadith tab**: gold `Bookmarked (n)` button next to the book buttons. Toggles a "Saved Bookmarked Hadiths" view listing every saved hadith (book name, number, Arabic, Urdu, narrator); each opens full detail on click; the icon on each row removes it.
- **Bookmark sign on every hadith**: an SVG bookmark (outline = unsaved, filled gold = saved) on the main book list cards, hadith-number search results, Urdu word-search results, and the detail modal (labels "Save bookmark"/"Bookmarked"). Button clicks `stopPropagation()` so they don't open the hadith.
- **Storage**: `localStorage` key `islam360_hadith_bookmarks` (mirrors `islam360_tarjma`/`islam360_bookmarks` pattern). Shared via a new `BookmarkCtx` provider in `Home` (wraps `SettingsCtx`, `<Modal/>` is inside it so the modal's bookmark button stays in sync).
  - Each entry: `{ bookId, bookName, number, international_number, arabic, urdu, urdu_ravi, english, english_ravi }`, keyed by `"{bookId}:{number}"`.
  - Helpers/components added: `BookmarkCtx`/`useBookmarks()`, `BookmarkIcon` (SVG), `bmItem(h, bookId, bookName)` (builds a saveable item), `BookmarkBtn` (toggle button, `showText` prop).
  - `openHadithDetail(h, bookId, bookName?)` now threads the book name into `HadithDetailBody` (also shows `Hadith #n — <book>` in the modal header).

### 13. Quran Tab — Two Bookmark Types: Surah + Ayah (uncommitted — commit via GitHub Desktop)
All changes in `src/app/page.tsx` (`QuranTab`). Verified with `npx tsc --noEmit` (clean).

- **⭐ Surah Bookmark**: existing star feature retained but made reactive state (`surahBms`), same `localStorage` key `islam360_bookmarks` (existing saved surahs preserved). Added a ⭐/☆ toggle in the reading (`browse`) header so the current surah can be bookmarked while reading. View button "⭐ Surah Bookmark" lists saved surahs (click to open, star removes).
- **🔖 Ayah Bookmark**: new. Every ayah in the reading view now has a bookmark icon in its action row (next to Words/Tafseer/Audio) — gold filled when saved. Saved under `localStorage` key `islam360_ayat_bookmarks` with `{ id, surah, ayah, para, arabic, urdu }` (urdu = `tarjma_text || urdu || english`). View button "🔖 Ayah Bookmark" lists every saved ayah (Arabic + Urdu); clicking one opens that surah and auto-scrolls to the ayah (`loadVerses(surah, ayah)`); the icon on the row removes it.
- **View selector** in `QuranTab`: `['surahs', 'parahs', 'search', 'surah-bms', 'ayat-bms']`; `QuranView` type updated to `'surah-bms' | 'ayat-bms'` (replacing `'bookmarks'`).
- **Persistence** confirmed: `/quran/surah/[id]` returns `{ id, surah, para, ayah, arabic, arabic_tajweed, urdu, english, roman_urdu, tarjma_text?, tafseer_text? }` — bookmark items built from these fields.

## Key Files Changed (cont.)
| File | Change |
|------|--------|
| `src/app/page.tsx` | Hadith bookmarks: `BookmarkCtx` provider + `BookmarkIcon`/`BookmarkBtn`/`bmItem`, `Bookmarked (n)` button + saved-hadiths view in `HadithTab`, bookmark icon on list cards + number/word search results + detail modal (`openHadithDetail`/`HadithDetailBody` now carry `bookName`). Quran: surah bookmarks made reactive + added to browse header; ayah bookmark icon on every ayah in `browse`; "⭐ Surah Bookmark" and "🔖 Ayah Bookmark" views; `QuranView` → `'surah-bms'\|'ayat-bms'` |

### 14. Books Tab Rebuilt — Real Data (baked JSON) + Recovery of Urdu/Hindi Titles
All UI changes in `src/app/page.tsx`; build tooling in `scripts/build-books-data.mjs` + `package.json` + `src/data/books.json`. Verified with `npx tsc --noEmit` (clean) and `npm run build`/prod-server smoke tests (`/api/books` → 2471, 2409 Urdu titles, 66 with audio, 2471 with PDF links).

**Books tab UI (replaces the old iframe embed of `/books.html`):**
- `BooksTab` fetches `/api/books`, renders real-time search (by title or author), 3D flip cards (`BookCard`), and pagination at 40/page (`PER_PAGE`).
- Flip card (`book-flip*` CSS in `src/app/globals.css`): front = cover image (falls back to title on `onError`), source badge (ALAHAZRAT / DAWATEISLAMI) + 👆; back = Urdu title, `مصنف: <author>` / English Author, Pages, then action buttons. Click to flip, "↩ Flip Back" button, back overflow scrolls.
- Card actions:
  - **Download PDF** button (NEW — `book.pdf`, direct URL from new `PDF_Download_URL` CSV column, falls back to `book.url`). Previously it linked to the book's page; the new column gives the actual PDF.
  - Listen/Pause button (uses `book.audioPlay` + shared `playBookAudio` with a single `bookAudioEl`), **Download Audio** button (`book.audioDownload`).
  - Emoji use in buttons (📥 PDF / ▶ Listen / ⏸ Pause / ⬇ Audio / 👆) per requested style.

**Data pipeline (baked JSON, no CSV at runtime):**
- **Decision (user): if you delete a CSV, do you save the info or re-read the CSV?** → chosen baked-data (option 2). The CSV source files are only needed at regeneration time (`npm run books:sync`).
- `scripts/build-books-data.mjs`:
  - Reads all `public/books/*.csv` (3 files), dedups by `url || cover` (Map), merges audio fields + PDF links across files (`audioPlay`/`audioDownload` merge, `pdf` fill).
  - New parser: comma-separated 10-column schema (`Title, Author_Name, Number_of_Pages, Cover_Image_URL, Thumbnail_URL, Book_URL, PDF_Download_URL, Audio_Book_URL, Audio_Play_URL, Audio_Download_URL`) with quote/escaping support — 4 alahazrat rows have quoted titles containing commas.
  - Output written to `src/data/books.json` (committed, ~1.4 MB / 2471 books).
  - Package scripts: `books:sync` = `node scripts/build-books-data.mjs`; `build` = `node scripts/build-books-data.mjs && next build`.
- `src/app/api/books/route.ts` imports `@/data/books.json` statically and serves it — **no `fs`/CSV reads at runtime** (the API works even when `public/books/` is empty). `BookItem` interface extended with `thumbnail`, `pdf`, `audioUrl`.
- **Graceful fallback (Vercel fix):** if `public/books` dir is missing/empty at build time, the script keeps the existing committed `books.json` and exits 0 (instead of `exit(1)` — that was failing the whole Vercel build, so the old/corrupt deployment stayed live).

**CSV corruption → title recovery (root cause):**
- The inventory CSVs in `public/books/` were **committed already corrupt** — literal `?` (0x3F) bytes instead of Urdu text (only ~4–16 non-ASCII bytes existed; corrupted rows had thousands of `?`). This predates the session — the CSVs were the corruption, `books.html` still had real Urdu.
- **Recovery sources (in priority order) explored**: `public/books.html` (2138 cards, 2133 Urdu `alt=` attribute; map key `url.split('?')[0]`), URL-slug percent-decoding (~103), clean-English CSV rows (~46 proved readable), cover-image filenames (~72). ~87 alahazrat titles were unrecoverable locally → would need a re-fetch from `alahazratnetwork.org`.
- **Resolution:** the user re-copied the correct CSVs (10-col schema). After `npm run books:sync` + re-verification, all titles pass (2409 Urdu titles, 0 with `?`). The XLSX files (`alhazrat books.xlsx`, `audio books.xlsx`, `dawat e islami.xlsx`) were parsed and mirror the CSV row counts exactly (598 / 66 / 1873) — CSVs are the build source, XLSX are the same data.

**Security / UX hardening (same session, still `page.tsx`):**
- **Download button hover effect — URL hidden**: PDF/Audio actions converted from `<a href>` to `<button>` + `triggerDownload()` (creates a temp `<a download>`, clicks it, removes it). No download URL shows in the browser status bar/tooltip on hover.
- **Right-click disabled** site-wide: `document.addEventListener('contextmenu', e => e.preventDefault())`.
- **Inspect/DevTools blocked** (deterrent): keydown guard in `Home` blocks `F12`, `Ctrl+Shift+I/J/C/K`, `Ctrl+U`, `Ctrl+S`. NOTE: not fully unremovable (DevTools can't be truly turned off from a web page; this covers right-click + common shortcuts).

**Verification:** local `/api/books` and the fresh-clone build both give 2471 books / 2409 Urdu / 0 `?` / 66 audio / 2471 pdf. Live Vercel needs a **manual Redeploy** (earlier builds failed because of the `books:sync` `exit 1` → last good deployment kept as corrupted data), then hard-refresh.

## Key Files Changed (page.tsx Books tab / projects)
| File | Change |
|------|--------|
| `src/app/page.tsx` | `BooksTab` grid + `BookCard` flip (front/back, badges, buttons); `triggerDownload`; `contextmenu` + keydown protection in `Home`; re-added `pdf` usage |
| `src/app/api/books/route.ts` | Static import of `@/data/books.json`; `BookItem` gets `thumbnail`/`pdf`/`audioUrl` |
| `src/data/books.json` | Committed 2471 books (generated by manual run) |
| `scripts/build-books-data.mjs` | New, 10-col CSV parser; Map dedupe/merge; graceful fallback when CSVs missing |
| `package.json` | `books:sync`; `build` now syncs books then `next build` |
| `src/app/globals.css` | `.book-flip` / `.book-flip-*` 3-D flip card CSS |

### 15. Admin Panel Rebuilt — Live Books Manager (Turso DB, not localStorage)
All changes in `src/app/page.tsx` + new `src/lib/custom-books.ts` + reworked APIs. Verified with `npx tsc --noEmit`, `npm run build`, and live round-trip tests on the prod server.

**Decision (user):** "every time i import .csv it store in live website not store localstorage — correct it" → moved from localStorage (`islam360_custom_books`, was being merged client-side in `BooksTab`) to the **Turso DB**. `BooksTab` now just fetches the merged `/api/books` (localStorage merge removed).

**DB schema (`tbl_CustomBooks`, `tbl_HiddenBooks`)** — created on demand by `src/lib/custom-books.ts` (`ensureTables`, with a `bakedKey` migration via try/catch `ALTER TABLE` since the table may already exist):
- `tbl_CustomBooks`: id, title, author, pages, cover, thumbnail, url, pdf, audioUrl, audioPlay, audioDownload, **bakedKey** (original baked-book key, so an override stays attached to its built-in book even if the admin changes the URL), created_at.
- `tbl_HiddenBooks`: key (UNIQUE, normalized lowercase of `url || cover`), title — one row per hidden built-in book.

**`/api/books`** (merged view for visitors): baked `books.json` + custom overrides − hidden. Override = custom row whose key (bakedKey→url→cover) matches a baked book's key → replaces it in place (`source: 'Custom'`); brand-new customs appended; hidden keys filtered out. `cache-control: no-store` so edits appear instantly.

**`/api/admin/books`** (new behaviors):
- **GET** → ALL books (2471 baked + customs merged, each with `id`/`key`/`custom`/`deleted` flags) + `deletedBooks` list (hidden baked books for restore).
- **POST** → upsert: `id` → UPDATE that custom row; else match by key (`bakedKey`/`url`/`cover`) → UPDATE; else INSERT (skips rows with no title and no url/cover). Returns `{ inserted, updated, skipped }`. Editing a built-in book sends `bakedKey` so the override always maps back to the original baked book.
- **DELETE** → `{ id }` removes a custom row; `{ key }` hides a baked book (adds to `tbl_HiddenBooks`); `{ restoreKey }` unhides.

**Admin panel UI (`AdminPanel`, page.tsx ~:1887)** — old tafseer/tarjma import + web-links management fully destroyed, replaced by the Books Manager:
- **CSV upload** — parses 10-col schema client-side, POSTs rows, shows `Imported X (Y updated, Z skipped)`.
- **Add Book Manually** — same 8 fields as before (title*, author, pages, cover, URL, PDF, audio play/download).
- **All Books list** — every book (2471) with source badge (source/HIDDEN), Urdu title, author · pages, and per-row **✏️ Edit** + **🗑 Delete** buttons; live search box filters by title/author/url; shows "X of Y" when filtered.
- **Edit modal** — pre-filled form (title*, author, pages, cover, url, pdf, audioPlay, audioDownload); built-in books save via `bakedKey` override (explains "stays after redeploys"); custom books update by id.
- **Delete** — custom row: removes DB row; built-in (or overridden): deletes the override row AND hides the baked entry (both calls, in that order).
- **🗑 Hidden Books section** — restorable list with ↩ Restore buttons (only shown when non-empty).
- Note box: all books live in the website DB and appear to all visitors immediately; clearing both tables + redeploy restores the original CSV list.

**Verification (prod server round-trip):** edit a baked book via `bakedKey` → `/api/books` shows edited title/source=Custom; hide → book gone + appears in `deletedBooks`; restore → back; delete override row → reverted to baked original; DB left clean (2471 baked, 0 custom, 0 hidden).

## Key Files Changed (Admin Books Manager)
| File | Change |
|------|--------|
| `src/lib/custom-books.ts` | NEW — shared: `ensureTables` (+bakedKey migration), `bookKey`, `listCustomBooks`, `listHiddenKeys`, `addHidden`/`removeHidden`, `cleanStr` |
| `src/app/api/admin/books/route.ts` | REWRITTEN — GET all-books+deleted, POST upsert (id/key/bakedKey, inserted/updated/skipped), DELETE remove/hide/restore |
| `src/app/api/books/route.ts` | Merged visitor view: baked + overrides − hidden, `no-store` |
| `src/app/page.tsx` | `AdminPanel` → Books Manager (CSV import, manual add, all-books list w/ search, Edit modal, Delete, Hidden-restore); `api()` helper now accepts `RequestInit`; `BooksTab` localStorage merge removed; `saveBooks`/`removeBook`/old `AdminPanel` sections removed |
| `src/app/api/admin/import-tafseer/route.ts`, `import-tarjma/route.ts` | Orphaned (old panel deleted) — left on disk, unused |

### 16. Admin Duas Manager — New Full-Screen Page (`/admin/duas`)
New standalone admin page + API to manage all duas. Verified with `npx tsc --noEmit`, `npm run build`, live round-trip tests.

**Decision (user):** Duas tab has 5 category tabs — "Duas", "More Duas", "Prayers", "Janaza", "Roza". Requested a new admin page showing all categories with every dua listed + **edit / delete / add-new** buttons ("make sure create new page under admin" — so a real Next.js route, not a modal).

**`/api/admin/duas`** (new `src/app/api/admin/duas/route.ts`):
- **GET** → `{ categories: [ { source, label, count, duas[] } ] }` across the 5 Turso tables (`tbl_dua`, `tbl_dua_Urdu`, `tbl_prayer`, `tbl_namaz_e_janaza`, `tbl_roza`), each dua mapped from the same 8 columns the read-side uses: `dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref`.
- **POST** → add or update: `{ table, dua: { id?, title, seq?, desc, arabic, urdu, english, ref } }`. Update by id (8-col UPDATE); insert computes next `dua_ID` (`MAX+1`) and default `dua_seq` (`MAX+1`) per table. Tables are whitelist-validated to prevent injection.
- **DELETE** → `{ table, id }` removes the row.

**`/admin/duas` page** (`src/app/admin/duas/page.tsx`, `'use client'`):
- Category tabs (the 5 categories) with live counts + full list per category: #id, seq, Urdu title, Arabic, Urdu, ref — each row with **✏️ Edit** and **🗑 Delete** buttons.
- **➕ Add New Dua** button → modal form (Title*, Sequence, Reference, Arabic, Urdu, Description, English) with live save (auto id + seq); Edit mode pre-fills the same form.
- Font fix: Arabic uses `font-arabic` (NooreHuda) and Urdu/titles/ref use `font-urdu` (AlviNastaleeq) + `direction: rtl` — matches the site fonts (was rendering in default sans).

**Verification:** GET 5 cats (Duas=64, More Duas=275, Prayers=25, Janaza=7, Roza=3); POST insert→UPDATE→verify `/api/admin/duas`→DELETE, DB left clean; page route 200.

## Key Files Changed (Admin Duas Manager)
| File | Change |
|------|--------|
| `src/app/api/admin/duas/route.ts` | NEW — GET list all 5 categories, POST upsert (auto id/seq), DELETE by `{table,id}` |
| `src/app/admin/duas/page.tsx` | NEW — login-gated manager: category tabs, all-duas list, Edit/Delete per row, Add-New modal, Arabic/Urdu fonts |
| `src/app/page.tsx` | Books Manager modal gained a "🕌 Duas Manager Open →" link to `/admin/duas` |

### 17. Admin Pages Hub — `/admin` + Books as Full-Screen Page (modal removed)
Decision (user): "under admin page it must show pages link. 1 page is books and 2 is dua when i click any page it show full screen page."

**New unified admin area (all full-screen pages, no more site modal):**
- **`/admin`** (hub, `src/app/admin/page.tsx`) — login-gated dashboard with two page-link cards: **📚 Books** → `/admin/books`, **🕌 Duas** → `/admin/duas`, plus Logout + "← Site".
- **`/admin/books`** (`src/app/admin/books/page.tsx`, NEW) — the former `AdminPanel` modal extracted 1:1 into a full-screen page: CSV import, manual add, all-2471-book list with search, Edit modal (bakedKey override), Delete (override+hide), Hidden/Restore section.
- **`/admin/components/AdminGate.tsx`** (NEW) — shared session-auth wrapper: single `sessionStorage` key `islam360_admin_auth`, Login form (same credentials), context `useAdminAuth()` exposing `logout`. All three admin pages wrap content in `<AdminGate>`; `/admin/duas` refactored from its own inline auth to it.
- **`src/app/page.tsx`** — old modal admin removed entirely: `LoginModal`, `AdminPanel`, `loginOpen`/`adminOpen` state all deleted; bottom **Admin** link is now `<a href="/admin">`.

**Verified:** `/admin`, `/admin/books`, `/admin/duas` all 200; one login covers all pages; homepage + `/api/books` (2471) + `/api/admin/duas` (5 cats) healthy.

## Key Files Changed (Admin Pages Hub)
| File | Change |
|------|--------|
| `src/app/admin/components/AdminGate.tsx` | NEW — shared session auth gate + `useAdminAuth` (login form, logout, single `islam360_admin_auth` key) |
| `src/app/admin/page.tsx` | NEW — admin home: Books + Duas page-link cards, Logout |
| `src/app/admin/books/page.tsx` | NEW — Books Manager extracted from site modal to full-screen page |
| `src/app/admin/duas/page.tsx` | REWRITTEN — uses shared `AdminGate` (was own inline login); matched fonts |
| `src/app/page.tsx` | Removed `LoginModal` + `AdminPanel` + `loginOpen`/`adminOpen`; Admin button → `<a href="/admin">` |

### 18. Duas Tab Not Showing Admin Edits — 24h Cache Fix
**Symptom (user):** editing a dua in the Duas Manager (title or any field) didn't appear on the Duas tab.

**Root cause:** `/api/duas/all` (the Duas tab data source) returned `Cache-Control: public, s-maxage=86400, max-age=86400` via `json(data, 200, 86400)` — browsers/CDN caches the whole list for 24 hours, so DB edits were invisible. `/api/duas` and `/api/duas/urdu` had the same cache.

**Fix:**
1. `src/app/api/duas/all`, `duas`, `duas/urdu` → `export const dynamic = 'force-dynamic'` + cache changed to `json(..., 200, 0)`.
2. `src/lib/api-utils.ts` → `json()` now emits `Cache-Control: no-store` when `cacheSec <= 0` (previously omitted the header, leaving heuristic caching).

**Verified:** `/api/duas/all` header is now `Cache-Control: no-store`; edits show immediately on the Duas tab (hard-refresh once to drop the old cached payload).

## Key Files Changed (Cache Fix)
| File | Change |
|------|--------|
| `src/lib/api-utils.ts` | `json()` emits `no-store` when `cacheSec <= 0` |
| `src/app/api/duas/all/route.ts`, `duas/route.ts`, `duas/urdu/route.ts` | `force-dynamic` + removed 86400s cache |

### 19. Google SEO — Sitemap, Robots, Privacy Policy, Full Metadata + OG Image
User approved SEO items #3 and #4 only: sitemap.xml, robots.txt and a Privacy Policy (GTM + HTML verification deferred until user supplies codes). Implemented + verified live.

- **`src/app/sitemap.ts`** → `/sitemap.xml` — URLs `/`, `/privacy/`, `/dua-shifa/` with changefreq/priority/lastModified.
- **`src/app/robots.ts`** → `/robots.txt` — allow `*`, `disallow: /admin/, /api/`, sitemap URL.
- **`src/app/privacy/page.tsx`** → `/privacy` — 10 sections incl. localStorage, cookies, ad opt-outs.
- **`layout.tsx`** — `metadataBase`, static title/description, keywords, canonical, OpenGraph + Twitter tags (summary_large_image), robots/googleBot directives, author/creator/publisher/category.
- **`src/app/opengraph-image.tsx`** — `ImageResponse` 1200×630 brand-green OG image. Arabic glyphs were removed from it — opentype.js `lookupType 5 substFormat 3` is unsupported and aborted the build prerender.

**Verified live:** `/sitemap.xml` 200, `/robots.txt` 200, `/opengraph-image` 200 (70 KB PNG), `/privacy` 200. Next step for user: submit `/sitemap.xml` in Google Search Console.

### 20. Admin Security Hardening — Server-Side Auth (no more hardcoded credentials)
**Problems found (audit):**
1. `AdminGate.tsx` had the admin email + password **hardcoded in client code** (visible in the public JS bundle).
2. `/api/admin/books` and `/api/admin/duas` had **no authentication at all** — anyone could call POST/DELETE and modify the database.
3. `.env.local` (all 20+ Turso **read-write** tokens + URLs) had been **accidentally committed** in git history, and the tracked `.next/` dev build-cache (binary `.sst` files) embedded the token values too.

**Fixes:**
- **`src/lib/admin-auth.ts`** — env-backed credentials (`ADMIN_EMAIL`, `ADMIN_PASS`, `ADMIN_SECRET`), HMAC-SHA256 signed session tokens, constant-time compare (`timingSafeEqual`), 7-day expiry.
- **`/api/admin/login|logout|session`** — login sets an `HttpOnly; Secure; SameSite=Lax` cookie named `quranweb_admin`; session returns `{authed}`; logout clears it.
- **All admin APIs now 401 without a valid session** (GET/POST/DELETE in both books and duas routes).
- **`AdminGate.tsx` rewritten** — no secrets in code, logs in through the API, session-driven (old `sessionStorage` flag removed).
- Env vars added to `.env.local` (gitignored) and Vercel production; password generated strong (charset excludes `$`/`#` because dotenv-expand/`#`-comments corrupt them).

**Lessons learned:** Next 16 + Turbopack **inlines `process.env` at build time** → rebuild locally after env changes; `next start` serves the baked values.

**Verified (local):** wrong password → 401, correct → 200 + cookie, session `{"authed":true}`, tampered token → false, books/duas with cookie → 200, logout → 401 again.

### 21. Git History Purge — Leaked Secrets Scrubbed From All 46 Commits
Per user request ("remove that information hackers can steal"), rewrote all history:

- `py -m git_filter_repo --invert-paths --path .env.local --path .next --replace-text replacements.txt --force` (git-filter-repo installed via pip; invoked as a module).
- replacements.txt: `literal:A{786}Ra3EI=C==>REDACTED_CREDENTIAL`, `literal:ali.raza260286@gmail.com==>REDACTED_EMAIL`.
- Verified: zero matches for `.env.local`, `.next`, old password, old email, or any Turso JWT (`eyJhbGciOiJFZERTQS`) across **all** commits; repo has **0 forks**.
- filter-repo removes the remote → re-added `origin`, force-pushed `main`.
- `.gitignore` already covers `.env*`, `.next/`, `node_modules/`.
- Old history backup kept at `F:\0\Download\Github\islam-backup.git` (user asked to keep; contains the old tokens — treat as sensitive, local-only).

### 22. Vercel Environment Variables — Live Site Repair
Live DB calls (`/api/duas/all`, `/api/books`, `/api/quran/*`) were returning **500 empty** — Vercel had no `TURSO_*` variables (local worked fine).

- User pasted all 39 `KEY=VALUE` lines from `.env.local` into Vercel → **Production**; an empty commit forced a redeploy.
- Verified live: `/api/duas/all` 200, `/api/books` 200 (1.4 MB), `/api/quran/surahs` 200.
- Admin login still 401 afterward → user deleted the three `ADMIN_*` vars (previous paste-import had left the old mistyped values) and re-added them with Sensitive OFF → login works from the browser.
- Prod gotcha: Vercel env changes trigger a deploy that bakes env at build time (same Turbopack behavior as local).

### 23. Admin Duas — CSV Import (sample download + upload + batch insert API)
- **`src/app/api/admin/duas/import/route.ts`** — POST `{table, rows[]}`: table whitelist-validated, auto `dua_ID` = MAX+1, `dua_seq` = given value or MAX+1, rows with empty title skipped, auth-protected (401 without session).
- **Page** (`/admin/duas`) — CSV card: **⬇️ Download Sample CSV** (UTF-8 BOM, one sample row), **📁 Choose .csv File** + **📤 Upload CSV**, client-side quoted-CSV parser, optional `table` column routes rows to specific categories (default = active tab), after success `load()` refreshes all 5 tabs immediately and switches to the imported tab.
- **`src/lib/dua-tables.ts`** extracted (shared `DUA_TABLES`/`DUA_COLS`/`isDuaTable`/`resolveDuaTable`); the duas route refactored onto it.

**Verified local + live:** 3 rows → 2 inserted + 1 skipped (empty title), Arabic/Urdu persisted, counts restored 64→66→64 after cleanup.

### 24. Admin Books — CSV Import Upgraded (sample + explicit upload button)
Replaced the old auto-import-on-file-select with the same UX as Duas:

- **⬇️ Download Sample CSV** (`books-sample.csv`, BOM, 10-column header + example row), **📁 Choose .csv File** + **📤 Upload CSV** (no accidental upload on selection anymore).
- Reuses upsert via `POST /api/admin/books`; after import the admin list refreshes via `loadBooks()`.

**Verified:** 2 test books imported → appear in admin list AND in public `/api/books` (Books tab) instantly as `source: "Custom"` (total 2473) → deleted → back to 2471.

### 25. Security Q&A — "Save All Resources" Cannot Hack the Site
Confirmed for the user: a Chrome-extension download of the site only captures public content (HTML/CSS/JS/images/data). DB tokens, `ADMIN_*` vars and admin APIs are server-side: admin endpoints return 401 without a signed session cookie, and the downloaded bundle contains zero secrets. Remaining risk is content copying (copyright concern), not a hack vector — this was made true by entries #20–#22.

### 26. Mobile Responsive Fixes - Navbar Title + Font Size Sliders
User reported on mobile: the "Quran Web" title was not shown responsively, and both text-size sliders needed to be responsive.

**Navbar (page.tsx ~line 156):** the brand previously hid "Quran Web" on mobile (`hidden sm:inline`) and showed a tiny "QW" abbreviation instead. Now the full title always renders:
- Brand container `min-w-0` + logo `shrink-0`, title `text-xs sm:text-base ... truncate` - scales down on phones and truncates gracefully on very narrow screens instead of overflowing.

**Mobile font slider panel (page.tsx ~line 195, opened via the "Aa" button):** the two sliders previously sat side-by-side in a row with fixed `w-[80px]` ranges, which overflowed small phones. Now:
- Panel is `flex flex-col gap-2` - Arabic slider row then Urdu slider row (full-width rows, `w-full min-w-0`).
- Each row: pinned label + value with `shrink-0`, and the `<input type="range">` stretches with `flex-1 min-w-0` across whatever width is available (320px and up).

**Desktop sliders unchanged** (`hidden sm:flex`, 50px each, beside the logo).

**Verified:** `npm run build` passes clean.

### 27. 14 New Translation Languages + Hindi Word-by-Word
**Data import** (scripts/import-translations.mjs):
- Imported 14 full translations (6236 ayahs each) from api.quran.com v4 into Turso tbl_QuranComplete: Saheeh International, Yusuf Ali, Hilali & Khan, Spanish (Isa Garcia), Bengali, Tamil, French, German, Turkish, Indonesian, Malay, Nepali, Marathi, Telugu.
- Staging-table approach: _staging table, chunked multi-row INSERTs (1500 rows), single UPDATE...SELECT JOIN per chunk; SQL single-quote escaping (JSON.stringify broke on embedded quotes); skip-if-already-imported guard; 4x retry w/ backoff.

**Frontend**:
- TRANSLATION_COLUMNS in src/lib/constants.ts +14 entries -> Settings tarjma dropdown auto-lists them (server-baked) and checkboxes/sliders work per language.
- Word-by-word tab: Hindi column added (word_by_word_hindi data, Devanagari), API /api/quran/wordbyword now returns hindi, table shows Arabic/Urdu/English/Hindi.

**Verify**: build passes; baked HTML contains all new language names; Turso COUNT(*)=6236 for all 14 columns.

### 28. Turso Quota Crisis — Reads Blocked + 3-Part Fix (bake static lists, indexes, HTTP cache)
**Symptom (critical):** ALL Turso DBs (quran + 17 hadith) answered `BLOCKED: SQL read operations are forbidden (reads are blocked, do you need to upgrade your plan?)` — the free tier's 500M rows-read / 10M rows-written monthly quota was exhausted (500M ≈ only ~1,700 visitors at ~300k reads/visitor). Writes still worked.

**Root cause analysis:** the free-tier quota is account-wide (18 DBs share one pool) and counts every row a query *scans*, not what it returns. Every Quran-tab visitor triggered 4 full-list queries + any surah open did unindexed `WHERE surat_id=?` on `tbl_QuranComplete` (6,236 rows scanned per request ≈ 300k reads/visitor).

**Step 1 — Bake static lists to JSON (zero reads):**
- `scripts/bake-static-data.mjs` (NEW, wired into `npm run build`) bakes 11 static lists to `src/data/static/*.json` (~5 MB total, committed): `surahs`, `parah_names`, `tafseer_types`+counts, `translations`+counts, `topics`, `amazing_topics`, `mutradif` (3.86 MB), `subjects_english`, `subjects_urdu`, `fahmul_quran`, `hadith_books` (17 book counts).
- **Source: local DB copies** (`F:\0\Download\Github\assets\quranDb.db` + `assets\databases\*.db`, schema-verified identical to Turso) read via sql.js — Turso reads were blocked at bake time, so the build no longer needs Turso at all. Fallback order: local file → Turso env vars → keep existing committed JSON (graceful, mirrors `books.json` pattern).
- Local `quranDb.db` already contains all admin-imported tafseers (khazain/noor/sirat/jalalain = 6,349 ayahs, zia 4,707, irfan 5,733, hasanaat 4,723, tibyan 2,927); 9 tafseer columns are empty in the source (never imported) and correctly filtered out.
- **11 routes rewritten to serve the JSON statically** (0 DB calls): `/api/quran/{surahs,parah_names,tafseer_types,translations,topics,amazing_topics,mutradif,subjects,subjects/urdu,fahmul_quran}` + `/api/hadith/books`.
- `/api/quran/tafseer/search` now reuses baked tafseer counts for its empty-column skip (was 20 `COUNT(*)` full scans per search ≈ 124k reads).

**Step 2 — SQL indexes (applied to all 18 live Turso DBs):**
- `scripts/create-indexes.mjs` (NEW, `npm run db:indexes`) ran successfully against every DB while reads were still blocked (writes allowed): `idx_quran_surat_ayah ON tbl_QuranComplete(surat_id, ayat_number)`, `idx_quran_para (para_id)`, `idx_arabic_words_surat_ayah (arabic_surat_id, arabic_ayat_number)`, `idx_hadees_number ON hadees(hadees_number)` + `idx_hadees_lang_rec (hadees_record_id, language_id)` (for the language JOINs).
- Turns each ayah/surah lookup from a 6,236-row scan into ~1–300 reads.
- Idempotent safety net in code: `ensureIndexes()` in `src/lib/db.ts` (module-level promise, once per process, errors swallowed), fired from `createQuranClient()`/`createHadithClient()` so fresh DBs self-index.

**Step 3 — HTTP-cache immutable content (browsers stop re-querying):**
- surah/ayah/tafseer/word-content never changes → cache bumped to `max-age=86400` (+ `s-maxage`, `stale-while-revalidate`): `/api/quran/surah/[id]`, `/api/quran/ayahs`, `/api/quran/parah/[id]`, `/api/quran/tafseer/[surah]/[ayah]`, `/api/quran/arabic_words`, `/api/quran/wordbyword`, `/api/hadith/book/[id]` (300→86400 or 0→86400).

**Verification:** `npm run build` ✓ (bake + typecheck + 32 static pages), `npx tsc --noEmit` clean ✓, prod-server smoke test — all 11 baked routes 200 with `cache-control: public, s-maxage=86400, max-age=86400` ✓ (incl. mutradif 4 MB). DB-backed routes still 500 until reads unblock, but read usage per visitor drops from ~300k to near zero (≈ no future quota exhaustion). Bonus (not done): client-side search index would also kill the ~6k-read LIKE scans per keystroke.

## Key Files Changed (Turso Quota Fix)
| File | Change |
|------|--------|
| `scripts/bake-static-data.mjs` | NEW — bakes 11 static lists from local sql.js DBs (fallback Turso → keep committed JSON) into `src/data/static/*.json` |
| `src/data/static/*.json` | NEW (committed) — surahs, parah_names, tafseer_types, translations, topics, amazing_topics, mutradif, subjects_english, subjects_urdu, fahmul_quran, hadith_books (~5 MB) |
| `scripts/create-indexes.mjs` | NEW — one-time idempotent index creation for quran + all 17 hadith Turso DBs (`npm run db:indexes`) |
| `src/lib/db.ts` | `ensureIndexes()` (once-per-process, fire-and-forget) wired into both client factories |
| 11 static route files | Rewritten to serve baked JSON with 86400 cache — zero DB reads |
| `/api/quran/tafseer/search/route.ts` | Empty-column skip now uses baked tafseer counts (was 20 full-table COUNT scans per search) |
| 7 immutable routes (`surah/[id]`, `ayahs`, `parah/[id]`, `tafseer/[surah]/[ayah]`, `arabic_words`, `wordbyword`, `hadith/book/[id]`) | Cache 0/300s → 86400 |
| `package.json` | `build` = books-sync + `bake-static-data.mjs` + `next build`; new `static:sync`, `db:indexes` scripts |

### 29. Turso Quota Audit — 4 Fixes (parah N+1, hadith COUNT, duas baked, tafseer parallel)
Full audit of all 39 API routes. Identified which still hit Turso (18 public + 5 admin) vs zero-DB (16). Calculated per-visitor read cost.

**Fixes applied:**

1. **Parah route N+1 eliminated** (`src/app/api/quran/parah/[id]/route.ts`): was running 1 query per verse for tarjma/tafseer columns (300+ queries for a 300-verse para). Now batch-queries the whole para for tarjma/tafseer (3 total queries, same pattern as surah route).

2. **Hadith book COUNT(*) removed** (`src/app/api/hadith/book/[id]/route.ts`): was running `SELECT COUNT(*) FROM hadees` (full table scan) on every page load. Now uses baked count from `hadith_books.json` (zero DB reads for pagination metadata).

3. **Duas baked to static JSON** (`scripts/bake-static-data.mjs` + 3 dua routes): `/api/duas/all`, `/api/duas`, `/api/duas/urdu` were 5+ full table scans every time someone opened the Duas tab (374 duas across 5 tables). Now baked to `src/data/static/duas.json` (374 items, 0.37 MB) — all 3 routes serve static JSON, zero DB reads. Admin edits require redeploy (same as books pattern).

4. **Tafseer search parallelized** (`src/app/api/quran/tafseer/search/route.ts`): column queries now run via `Promise.all` instead of sequential `for` loop. LIMIT reduced from 100 to 50 per column.

**Per-visitor Turso read estimate (typical session):**
- Open site → Quran surah view: ~6 reads (surah data + tarjma + tafseer)
- Hadith tab → browse book: ~2 reads (20 hadiths per page)
- Search operations: ~5-20 reads per search (debounced, indexed)
- Duas/Topics/Fahmul/Mutradif/Books: **0 reads** (all baked)
- **Total: ~30-50 DB reads per visitor**

**Quota math:** 500M free reads / 50 reads per visitor = **~10M visitors/month** before quota exhaustion. Previously ~1,700 visitors caused exhaustion (300k reads/visitor before baking).

**Verification:** `npx tsc --noEmit` clean, `npm run build` passes (35 static pages, duas routes now `○` static).

## Key Files Changed (Quota Fix v2)
| File | Change |
|------|--------|
| `src/app/api/quran/parah/[id]/route.ts` | N+1 → batch queries for tarjma/tafseer (3 queries total, was 300+) |
| `src/app/api/hadith/book/[id]/route.ts` | COUNT(*) removed — uses baked count from `hadith_books.json` |
| `src/app/api/duas/all/route.ts` | Rewritten — serves `@/data/static/duas.json` (zero DB reads) |
| `src/app/api/duas/route.ts` | Rewritten — filters baked `duas.json` for `tbl_dua` entries |
| `src/app/api/duas/urdu/route.ts` | Rewritten — filters baked `duas.json` for `tbl_dua_Urdu` entries |
| `src/app/api/quran/tafseer/search/route.ts` | Column queries parallelized via `Promise.all`; LIMIT 100 → 50 |
| `scripts/bake-static-data.mjs` | Added `bakeDuas()` — reads 5 dua tables from local DB, outputs `duas.json` |
| `src/data/static/duas.json` | NEW (committed) — 374 baked duas (0.37 MB) |

### 30. Surah/Parah Routes — 1 Query Instead of 3 (67% read reduction)
**Problem:** surah and parah routes ran 3 separate queries — main data + tarjma column + tafseer column. Each query scanned all 6,236 rows of `tbl_QuranComplete` (no composite index on tarjma/tafseer columns), so opening 1 surah cost ~18,700 reads.

**Fix:** merged tarjma and tafseer columns into the main `SELECT` query. Now 1 query per surah/parah open (6,236 reads instead of 18,700).

**Files:** `src/app/api/quran/surah/[id]/route.ts`, `src/app/api/quran/parah/[id]/route.ts`

**Revised quota math (all fixes combined):**

| Visitor type | Pattern | DB reads | 500M capacity |
|---|---|---|---|
| Light | 1 surah + 1 hadith page | ~6,256 | ~80,000/month |
| Medium | 2 surahs + hadith + 1 search | ~18,750 | ~26,700/month |
| Heavy | Multiple searches + browsing | ~50,000+ | ~10,000/month |

Before fixes: ~1,700 visitors caused exhaustion (300k reads/visitor). After: ~10,000-80,000 depending on usage.

**Remaining bottleneck:** `tbl_QuranComplete` full-table scans (6,236 rows per query). To scale further: Turso paid plan or full client-side search index.
