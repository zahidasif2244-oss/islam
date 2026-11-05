import type { Client } from '@libsql/client'
import { createQuranClient, query, run } from '@/lib/db'
import { duaKey } from '@/lib/dua-titles'
import { createServerCache } from '@/lib/server-cache'

/**
 * Admin edits for the baked dua list.
 *
 * Duas are served as a static file (`/data/static/duas.json`) so the tab opens
 * instantly without touching a database. Admin changes therefore live in this
 * small overlay table and the client applies them on top of the static file.
 * Every write in `src/app/api/admin/duas` records the same change here.
 */
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS tbl_DuaOverrides (
  row_key TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  dua_id INTEGER NOT NULL,
  dua_seq INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  arabic TEXT,
  urdu TEXT,
  english TEXT,
  reference TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`

export type DuaOverride = {
  key: string
  table: string
  id: number
  seq: number
  title: string | null
  desc: string | null
  arabic: string | null
  urdu: string | null
  english: string | null
  ref: string | null
  deleted: boolean
}

let readyPromise: Promise<void> | null = null

export function ensureDuaOverrides(client?: Client): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const db = client || createQuranClient()
      await run(db, CREATE_SQL)
    })().catch(err => {
      // Allow a later request to retry if the database was briefly unreachable.
      readyPromise = null
      throw err
    })
  }
  return readyPromise
}

/**
 * The overlay is tiny and read on every page load. Five seconds is enough to
 * collapse a burst of visitors into one Turso read, while still letting an
 * admin edit appear on the next normal reload (admin writes also invalidate
 * this cache immediately on the instance that handled the write).
 */
export const duaOverridesCache = createServerCache<DuaOverride[]>('dua-overrides', 5_000)

export function invalidateDuaOverrides(): void {
  duaOverridesCache.invalidate()
}

function value(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return String(v)
}

function rowToOverride(r: any): DuaOverride {
  return {
    key: String(r.row_key || duaKey(String(r.table_name || ''), r.dua_id, r.dua_seq)),
    table: String(r.table_name || ''),
    id: Number(r.dua_id),
    seq: Number(r.dua_seq),
    title: value(r.title),
    desc: value(r.description),
    arabic: value(r.arabic),
    urdu: value(r.urdu),
    english: value(r.english),
    ref: value(r.reference),
    deleted: Number(r.deleted || 0) !== 0,
  }
}

/** Best-effort: a missing/unreachable overlay table must never break the site. */
export async function listDuaOverrides(): Promise<DuaOverride[]> {
  return duaOverridesCache.load(async () => {
    try {
      await ensureDuaOverrides()
      const rows = await query(
        createQuranClient(),
        `SELECT row_key, table_name, dua_id, dua_seq, title, description, arabic, urdu, english, reference, deleted
           FROM tbl_DuaOverrides`
      )
      return rows.map(rowToOverride)
    } catch {
      return []
    }
  })
}

export async function getDuaOverrideMap(): Promise<Map<string, DuaOverride>> {
  const rows = await listDuaOverrides()
  return new Map(rows.map(r => [r.key, r]))
}

export type OverlayStatement = { sql: string; args: any[] }

/** Build (but do not execute) a full-row overlay upsert. */
export function duaOverrideStatement(o: {
  key: string
  table: string
  id: number
  seq: number
  title?: string | null
  desc?: string | null
  arabic?: string | null
  urdu?: string | null
  english?: string | null
  ref?: string | null
  deleted?: boolean
}): OverlayStatement {
  return {
    sql: `INSERT INTO tbl_DuaOverrides
            (row_key, table_name, dua_id, dua_seq, title, description, arabic, urdu, english, reference, deleted, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(row_key) DO UPDATE SET
            table_name = excluded.table_name,
            dua_id = excluded.dua_id,
            dua_seq = excluded.dua_seq,
            title = excluded.title,
            description = excluded.description,
            arabic = excluded.arabic,
            urdu = excluded.urdu,
            english = excluded.english,
            reference = excluded.reference,
            deleted = excluded.deleted,
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      o.key,
      o.table,
      o.id,
      o.seq,
      o.title ?? null,
      o.desc ?? null,
      o.arabic ?? null,
      o.urdu ?? null,
      o.english ?? null,
      o.ref ?? null,
      o.deleted ? 1 : 0,
    ],
  }
}

/** Build (but do not execute) a title-only overlay upsert for a group row. */
export function duaTitleOverrideStatement(
  table: string,
  id: number,
  seq: number,
  title: string
): OverlayStatement {
  return {
    sql: `INSERT INTO tbl_DuaOverrides (row_key, table_name, dua_id, dua_seq, title, deleted)
          VALUES (?, ?, ?, ?, ?, 0)
          ON CONFLICT(row_key) DO UPDATE SET
            title = excluded.title,
            dua_seq = excluded.dua_seq,
            deleted = 0,
            updated_at = CURRENT_TIMESTAMP`,
    args: [duaKey(table, id, seq), table, id, seq, title],
  }
}

/** Build (but do not execute) a tombstone that hides a baked row. */
export function duaDeleteOverrideStatement(table: string, id: number, seq: number): OverlayStatement {
  return {
    sql: `INSERT INTO tbl_DuaOverrides (row_key, table_name, dua_id, dua_seq, deleted)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT(row_key) DO UPDATE SET
            dua_seq = excluded.dua_seq,
            deleted = 1,
            updated_at = CURRENT_TIMESTAMP`,
    args: [duaKey(table, id, seq), table, id, seq],
  }
}

/** Full row override (used for edits, new rows and CSV imports). */
export async function saveDuaOverride(o: {
  key: string
  table: string
  id: number
  seq: number
  title?: string | null
  desc?: string | null
  arabic?: string | null
  urdu?: string | null
  english?: string | null
  ref?: string | null
  deleted?: boolean
}): Promise<void> {
  await ensureDuaOverrides()
  const stmt = duaOverrideStatement(o)
  await run(createQuranClient(), stmt.sql, stmt.args as any[])
  invalidateDuaOverrides()
}

/**
 * Title-only override for the rest of a topic group.
 *
 * A topic (`dua_ID`) owns several content rows; changing the title must change
 * it on every row, not just the row the admin clicked. The other fields are
 * left untouched.
 */
export async function saveDuaTitleOverride(
  table: string,
  id: number,
  seq: number,
  title: string
): Promise<void> {
  await ensureDuaOverrides()
  const stmt = duaTitleOverrideStatement(table, id, seq, title)
  await run(createQuranClient(), stmt.sql, stmt.args as any[])
  invalidateDuaOverrides()
}

/** Hide a baked row on the website without deleting unrelated rows. */
export async function deleteDuaOverride(table: string, id: number, seq: number): Promise<void> {
  await ensureDuaOverrides()
  const stmt = duaDeleteOverrideStatement(table, id, seq)
  await run(createQuranClient(), stmt.sql, stmt.args as any[])
  invalidateDuaOverrides()
}
