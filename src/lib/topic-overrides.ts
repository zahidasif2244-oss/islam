import type { Client } from '@libsql/client'
import { createQuranClient, query, run } from '@/lib/db'
import { createServerCache } from '@/lib/server-cache'
import { isTopicKind, topicRowKey, type TopicKind } from '@/lib/topic-merge'

/**
 * Admin edits for the baked topic lists.
 *
 * `/data/static/topics.json` and `amazing_topics.json` stay on the CDN so both
 * public tabs open without a database round trip. Admin changes therefore live
 * in this small overlay table and the client applies them on top of the static
 * files. A row with `custom = 1` was created in the admin page; a row with
 * `deleted = 1` hides a baked row without touching the JSON file.
 */
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS tbl_TopicOverrides (
  row_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  surah INTEGER,
  surah_name TEXT,
  start_ayah INTEGER,
  end_ayah INTEGER,
  ayah INTEGER,
  para INTEGER,
  urdu TEXT,
  english TEXT,
  custom INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_topic_overrides_kind
  ON tbl_TopicOverrides(kind, topic_id)`

export type TopicOverride = {
  key: string
  kind: TopicKind
  id: number
  surah: number | null
  surah_name: string | null
  start_ayah: number | null
  end_ayah: number | null
  ayah: number | null
  para: number | null
  urdu: string | null
  english: string | null
  custom: boolean
  deleted: boolean
}

export type TopicStatement = { sql: string; args: any[] }

let readyPromise: Promise<void> | null = null

export function ensureTopicOverrides(client?: Client): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const db = client || createQuranClient()
      await run(db, CREATE_SQL)
      await run(db, CREATE_INDEX_SQL)
    })().catch(err => {
      // Allow a later request to retry if the database was briefly unreachable.
      readyPromise = null
      throw err
    })
  }
  return readyPromise
}

/**
 * The overlay is tiny and read on every page load. Five seconds collapses a
 * burst of visitors into one Turso read; admin writes invalidate the local copy
 * immediately so the next reload sees the edit.
 */
export const topicOverridesCache = createServerCache<TopicOverride[]>('topic-overrides', 5_000)

export function invalidateTopicOverrides(): void {
  topicOverridesCache.invalidate()
}

function value(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return String(v)
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function rowToOverride(r: any): TopicOverride {
  const kind: TopicKind = isTopicKind(r.kind) ? r.kind : 'topics'
  const id = Number(r.topic_id)
  return {
    key: String(r.row_key || topicRowKey(kind, id)),
    kind,
    id,
    surah: num(r.surah),
    surah_name: value(r.surah_name),
    start_ayah: num(r.start_ayah),
    end_ayah: num(r.end_ayah),
    ayah: num(r.ayah),
    para: num(r.para),
    urdu: value(r.urdu),
    english: value(r.english),
    custom: Number(r.custom || 0) !== 0,
    deleted: Number(r.deleted || 0) !== 0,
  }
}

/** Strict read used by the admin API; throws so a database error is visible. */
export async function readTopicOverrides(): Promise<TopicOverride[]> {
  const db = createQuranClient()
  await ensureTopicOverrides(db)
  const rows = await query(
    db,
    `SELECT row_key, kind, topic_id, surah, surah_name, start_ayah, end_ayah,
            ayah, para, urdu, english, custom, deleted
       FROM tbl_TopicOverrides
      ORDER BY kind, surah, COALESCE(start_ayah, ayah), topic_id`
  )
  return rows.map(rowToOverride)
}

/** Best-effort read for the public site; a DB failure must not break the tab. */
export async function listTopicOverrides(): Promise<TopicOverride[]> {
  return topicOverridesCache.load(async () => {
    try {
      return await readTopicOverrides()
    } catch {
      return []
    }
  })
}

/** Build (but do not execute) a full-row overlay upsert. */
export function topicOverrideStatement(o: {
  key: string
  kind: TopicKind
  id: number
  surah: number | null
  surah_name?: string | null
  start_ayah?: number | null
  end_ayah?: number | null
  ayah?: number | null
  para?: number | null
  urdu?: string | null
  english?: string | null
  custom?: boolean
  deleted?: boolean
}): TopicStatement {
  return {
    sql: `INSERT INTO tbl_TopicOverrides
            (row_key, kind, topic_id, surah, surah_name, start_ayah, end_ayah,
             ayah, para, urdu, english, custom, deleted, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(row_key) DO UPDATE SET
            kind = excluded.kind,
            topic_id = excluded.topic_id,
            surah = excluded.surah,
            surah_name = excluded.surah_name,
            start_ayah = excluded.start_ayah,
            end_ayah = excluded.end_ayah,
            ayah = excluded.ayah,
            para = excluded.para,
            urdu = excluded.urdu,
            english = excluded.english,
            custom = excluded.custom,
            deleted = excluded.deleted,
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      o.key,
      o.kind,
      o.id,
      o.surah,
      o.surah_name ?? null,
      o.start_ayah ?? null,
      o.end_ayah ?? null,
      o.ayah ?? null,
      o.para ?? null,
      o.urdu ?? null,
      o.english ?? null,
      o.custom ? 1 : 0,
      o.deleted ? 1 : 0,
    ],
  }
}

/** Build (but do not execute) a tombstone that hides a baked row. */
export function topicTombstoneStatement(kind: TopicKind, id: number): TopicStatement {
  return {
    sql: `INSERT INTO tbl_TopicOverrides (row_key, kind, topic_id, custom, deleted)
          VALUES (?, ?, ?, 0, 1)
          ON CONFLICT(row_key) DO UPDATE SET
            deleted = 1,
            updated_at = CURRENT_TIMESTAMP`,
    args: [topicRowKey(kind, id), kind, id],
  }
}

/** Build (but do not execute) a restore for a tombstoned baked row. */
export function topicRestoreStatement(kind: TopicKind, id: number): TopicStatement {
  return {
    sql: `UPDATE tbl_TopicOverrides
             SET deleted = 0, updated_at = CURRENT_TIMESTAMP
           WHERE row_key = ?`,
    args: [topicRowKey(kind, id)],
  }
}

/** Build (but do not execute) a hard delete for an admin-created row. */
export function topicDeleteStatement(kind: TopicKind, id: number): TopicStatement {
  return {
    sql: `DELETE FROM tbl_TopicOverrides WHERE row_key = ?`,
    args: [topicRowKey(kind, id)],
  }
}
