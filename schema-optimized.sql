-- ============================================================
--  Quran Web — optimised schema
--  Target: Turso / libSQL. Cut DB from ~150–250 MB to ~25–35 MB
--  and make every lookup a single contiguous range scan.
--
--  Run inside:  turso db shell <db-name>
--  ALWAYS take a branch/backup first:
--    turso db create quran-v2 --from-db quran
-- ============================================================

PRAGMA foreign_keys = ON;

-- 4 KiB pages let libSQL pack more rows per page for text-heavy tables.
-- Must be set BEFORE tables are created to take effect.
PRAGMA page_size = 4096;

BEGIN;

-- ------------------------------------------------------------
-- 1. Reference tables (tiny, read once)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS surah (
  id             INTEGER PRIMARY KEY,     -- 1..114
  name_ar        TEXT    NOT NULL,
  name_en        TEXT    NOT NULL,
  name_translit  TEXT,
  ayah_count     INTEGER NOT NULL,
  revelation     TEXT,                    -- 'Meccan' | 'Medinan'
  para_start     INTEGER
);

-- 114 + 30 rows. Stored on CDN as meta/*.json too; kept here only
-- for joins and admin screens.
CREATE TABLE IF NOT EXISTS parah (
  id           INTEGER PRIMARY KEY,       -- 1..30
  name_ar      TEXT NOT NULL,
  start_surah  INTEGER NOT NULL,
  start_ayah   INTEGER NOT NULL,
  end_surah    INTEGER NOT NULL,
  end_ayah     INTEGER NOT NULL
);

-- Replaces the hard-coded arrays in the client bundle.
CREATE TABLE IF NOT EXISTS edition (
  key        TEXT PRIMARY KEY,            -- 'ur_juna_garhi', 'en_saheeh_intl'
  kind       TEXT NOT NULL,               -- 'translation' | 'tafseer'
  label      TEXT NOT NULL,
  lang       TEXT NOT NULL,               -- 'ur','en','hi','tr',...
  is_rtl     INTEGER NOT NULL DEFAULT 0,
  ayah_count INTEGER NOT NULL DEFAULT 0,
  enabled    INTEGER NOT NULL DEFAULT 1   -- flip to 0 to retire an edition
);

-- ------------------------------------------------------------
-- 2. Ayah — the core table
--
--    WITHOUT ROWID + PRIMARY KEY (surah_id, ayah_no) means the
--    table IS the index: surah 2's 286 ayahs live on consecutive
--    pages, so "give me surah 2" is one short sequential read.
--
--    Deliberately NOT stored here:
--      * arabic_tajweed  -> separate optional table (it is a 2nd
--                           full copy of the Arabic text, ~2-3 MB)
--      * urdu/english/roman_urdu/hindi -> moved to `translation`
--        (they made every row ~1.3 KB wide instead of ~260 B)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ayah (
  surah_id    INTEGER NOT NULL REFERENCES surah(id),
  ayah_no     INTEGER NOT NULL,           -- 1-based; bismillah is not row 0
  para_id     INTEGER NOT NULL,
  juz_id      INTEGER,
  page_no     INTEGER,
  arabic      TEXT    NOT NULL,           -- Uthmani, with diacritics
  arabic_norm TEXT,                       -- no diacritics, for search/compare
  PRIMARY KEY (surah_id, ayah_no)
) WITHOUT ROWID;

-- parah / juz navigation are the only other access patterns.
CREATE INDEX IF NOT EXISTS idx_ayah_para ON ayah (para_id, surah_id, ayah_no);
CREATE INDEX IF NOT EXISTS idx_ayah_juz  ON ayah (juz_id, surah_id, ayah_no);

-- Optional: tajweed-coloured text. Only ship it if the UI needs it,
-- and only fetch it when the user enables tajweed mode.
CREATE TABLE IF NOT EXISTS ayah_tajweed (
  surah_id  INTEGER NOT NULL,
  ayah_no   INTEGER NOT NULL,
  text      TEXT    NOT NULL,
  PRIMARY KEY (surah_id, ayah_no)
) WITHOUT ROWID;

-- ------------------------------------------------------------
-- 3. Translations — ONE table for all 25+ editions
--
--    PK order (edition, surah_id, ayah_no) is chosen so that
--    "edition X, surah 2" is a contiguous range scan and needs
--    no secondary index at all.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS translation (
  edition   TEXT    NOT NULL REFERENCES edition(key),
  surah_id  INTEGER NOT NULL,
  ayah_no   INTEGER NOT NULL,
  text      TEXT    NOT NULL,
  PRIMARY KEY (edition, surah_id, ayah_no)
) WITHOUT ROWID;

-- ------------------------------------------------------------
-- 4. Tafseer — same shape, much larger rows.
--    Consider exporting these to static JSON instead (see plan §5
--    Phase 3) — they are ~100–150 MB and immutable.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tafseer (
  edition   TEXT    NOT NULL REFERENCES edition(key),
  surah_id  INTEGER NOT NULL,
  ayah_no   INTEGER NOT NULL,
  text      TEXT    NOT NULL,
  PRIMARY KEY (edition, surah_id, ayah_no)
) WITHOUT ROWID;

-- ------------------------------------------------------------
-- 5. Word-by-word — clustered by ayah so one ayah = one page.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS word (
  surah_id  INTEGER NOT NULL,
  ayah_no   INTEGER NOT NULL,
  position  INTEGER NOT NULL,             -- 1-based, left-to-right
  arabic    TEXT    NOT NULL,
  translit  TEXT,
  urdu      TEXT,
  english   TEXT,
  PRIMARY KEY (surah_id, ayah_no, position)
) WITHOUT ROWID;

-- ------------------------------------------------------------
-- 6. Full-text search (replaces LIKE '%term%' which times out)
--    remove_diacritics 2 is required for Arabic: it makes
--    الرحمن match الرَّحْمَٰن.
-- ------------------------------------------------------------

CREATE VIRTUAL TABLE IF NOT EXISTS ayah_fts USING fts5(
  arabic,
  translation,
  edition   UNINDEXED,
  surah_id  UNINDEXED,
  ayah_no   UNINDEXED,
  tokenize  = 'unicode61 remove_diacritics 2'
);

-- ------------------------------------------------------------
-- 7. User data — the ONLY thing that stays on the hot path
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_bookmark (
  user_id   TEXT    NOT NULL,
  surah_id  INTEGER NOT NULL,
  ayah_no   INTEGER NOT NULL,
  note      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, surah_id, ayah_no)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS user_progress (
  user_id     TEXT PRIMARY KEY,
  surah_id    INTEGER NOT NULL DEFAULT 1,
  ayah_no     INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
) WITHOUT ROWID;

COMMIT;

-- ============================================================
--  MIGRATION (adapt table/column names to your current schema)
--  Run in a NEW database, verify, then swap.
-- ============================================================

/*
-- 1. Reference data
INSERT INTO surah (id, name_ar, name_en, name_translit, ayah_count, revelation, para_start)
SELECT id, arabic, english, NULL, ayah_count, revelation, para_start FROM old_surah_names;

INSERT INTO parah SELECT id, arabic_name, start_surah, start_ayah, end_surah, end_ayah FROM old_parah_names;

INSERT INTO edition (key, kind, label, lang, is_rtl, ayah_count)
SELECT key, 'translation', label, lower(substr(key,1,2)), is_urdu, count FROM old_translations;

-- 2. Ayahs WITHOUT the duplicate Arabic and WITHOUT the 4 inline translations
INSERT INTO ayah (surah_id, ayah_no, para_id, juz_id, page_no, arabic)
SELECT surah, ayah, para, juz, page, arabic
  FROM quran
 WHERE ayah > 0;                        -- skips the duplicated bismillah prefix row

-- 3. Pull the inline translation columns out into their own rows
INSERT INTO translation (edition, surah_id, ayah_no, text)
SELECT 'ur_juna_garhi', surah, ayah, urdu   FROM quran WHERE ayah > 0 AND urdu        IS NOT NULL AND urdu        <> '';
INSERT INTO translation (edition, surah_id, ayah_no, text)
SELECT 'en_saheeh_intl', surah, ayah, english FROM quran WHERE ayah > 0 AND english    IS NOT NULL AND english    <> '';
INSERT INTO translation (edition, surah_id, ayah_no, text)
SELECT 'roman_urdu',   surah, ayah, roman_urdu FROM quran WHERE ayah > 0 AND roman_urdu IS NOT NULL AND roman_urdu <> '';
INSERT INTO translation (edition, surah_id, ayah_no, text)
SELECT 'hi_nazar',     surah, ayah, hindi    FROM quran WHERE ayah > 0 AND hindi      IS NOT NULL AND hindi      <> '';

-- 4. Tajweed only if the feature is used
INSERT INTO ayah_tajweed (surah_id, ayah_no, text)
SELECT surah, ayah, arabic_tajweed FROM quran WHERE ayah > 0 AND arabic_tajweed IS NOT NULL;

-- 5. Translations that currently live in their own tables
INSERT INTO translation (edition, surah_id, ayah_no, text)
SELECT 'tr_diyanet', surah, ayah, text FROM old_translation_turkish;

-- 6. Search index
INSERT INTO ayah_fts (arabic, translation, edition, surah_id, ayah_no)
SELECT a.arabic, COALESCE(t.text, ''), 'en_saheeh_intl', a.surah_id, a.ayah_no
  FROM ayah a
  LEFT JOIN translation t
         ON t.surah_id = a.surah_id AND t.ayah_no = a.ayah_no
        AND t.edition  = 'en_saheeh_intl';
*/

-- ============================================================
--  FINALISE  (order matters)
-- ============================================================
-- ANALYZE;                       -- 1. gather planner statistics
-- VACUUM;                        -- 2. reclaim pages freed by deletes

-- ============================================================
--  USEFUL QUERIES
-- ============================================================

-- Size per table (needs dbstat support)
-- SELECT name, SUM(pgsize)/1024/1024 AS mb FROM dbstat GROUP BY name ORDER BY mb DESC;

-- Portable size estimate
-- SELECT 'ayah' AS t, COUNT(*) n, SUM(LENGTH(arabic))/1048576.0 mb FROM ayah
-- UNION ALL SELECT 'translation', COUNT(*), SUM(LENGTH(text))/1048576.0 FROM translation
-- UNION ALL SELECT 'tafseer',     COUNT(*), SUM(LENGTH(text))/1048576.0 FROM tafseer
-- UNION ALL SELECT 'word',        COUNT(*), SUM(LENGTH(arabic))/1048576.0 FROM word;

-- Verify the plan is indexed (must show SEARCH, not SCAN)
-- EXPLAIN QUERY PLAN
--   SELECT a.ayah_no, a.arabic, t.text
--     FROM ayah a
--     LEFT JOIN translation t
--       ON t.surah_id = a.surah_id AND t.ayah_no = a.ayah_no AND t.edition = 'en_saheeh_intl'
--    WHERE a.surah_id = 2
--    ORDER BY a.ayah_no;

-- Search (instant, indexed) instead of LIKE '%term%'
-- SELECT surah_id, ayah_no, snippet(ayah_fts, 1, '<mark>', '</mark>', '…', 24) AS snip
--   FROM ayah_fts
--  WHERE ayah_fts MATCH 'mercy'
--  LIMIT 50;
