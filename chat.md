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
