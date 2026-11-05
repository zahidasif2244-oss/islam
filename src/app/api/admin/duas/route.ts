import type { InStatement } from '@libsql/client'
import { createQuranClient, query, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { DUA_TABLES, DUA_COLS, isDuaTable, resolveDuaTable } from '@/lib/dua-tables'
import { duaKey, normalizeDuaTitles, parseDuaKey } from '@/lib/dua-titles'
import {
  duaDeleteOverrideStatement,
  duaOverrideStatement,
  duaTitleOverrideStatement,
  ensureDuaOverrides,
  getDuaOverrideMap,
  invalidateDuaOverrides,
  saveDuaOverride,
} from '@/lib/dua-overrides'

export const dynamic = 'force-dynamic'

function clean(v: unknown, max = 20000): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().slice(0, max)
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** tbl_dua and tbl_dua_Urdu are parallel tables for the same topic IDs. */
function counterpartTable(table: string): string | null {
  if (table === 'tbl_dua') return 'tbl_dua_Urdu'
  if (table === 'tbl_dua_Urdu') return 'tbl_dua'
  return null
}

export async function GET(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const db = createQuranClient()

    // One UNION ALL read instead of one query per category. The admin list
    // needs every row anyway, so this only removes round trips.
    const union = DUA_TABLES.map(
      ([table]) => `SELECT '${table}' AS source, ${DUA_COLS.join(',')} FROM ${resolveDuaTable(table)}`
    ).join('\nUNION ALL\n')
    const raw = await query(db, `${union}\nORDER BY dua_ID, dua_seq`)

    const overrideMap = await getDuaOverrideMap()
    const all: any[] = []

    for (const [table] of DUA_TABLES) {
      for (const r of raw) {
        if (String(r.source) !== table) continue
        const id = Number(r.dua_ID)
        const seq = Number(r.dua_seq)
        const key = duaKey(table, id, seq)
        const o = overrideMap.get(key)
        if (o?.deleted) continue

        all.push({
          key,
          source: table,
          id,
          seq,
          title: o?.title ?? getText(r.dua_title),
          desc: o?.desc ?? getText(r.dua_desc),
          arabic: o?.arabic ?? getText(r.dua_arabic),
          urdu: o?.urdu ?? getText(r.dua_urdu),
          english: o?.english ?? getText(r.dua_eng),
          ref: o?.ref ?? getText(r.dua_ref),
        })
      }
    }

    const rows = normalizeDuaTitles(all)
    const categories = DUA_TABLES.map(([table, label]) => {
      const duas = rows.filter(r => r.source === table)
      return { source: table, label, count: duas.length, duas }
    })

    return json({ categories })
  } catch (e: any) {
    return error(e.message || 'Failed to list duas', 500)
  }
}

export async function POST(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const table = clean(body.table)
    const dua = body.dua || body
    if (!isDuaTable(table)) return error('invalid table', 400)
    if (!dua || typeof dua !== 'object') return error('dua object required', 400)

    const title = clean(dua.title)
    if (!title) return error('Title required', 400)

    const desc = clean(dua.desc)
    const arabic = clean(dua.arabic)
    const urdu = clean(dua.urdu)
    const english = clean(dua.english)
    const ref = clean(dua.ref)
    const requestedSeq = numOrNull(dua.seq)

    const parsedKey = parseDuaKey(dua.key)
    const bodyId = numOrNull(dua.id)
    const editId = parsedKey?.id ?? bodyId
    const real = resolveDuaTable(table)
    const db = createQuranClient()

    if (editId !== null) {
      const twin = counterpartTable(table)

      // One round trip for the topic group and its parallel table.
      const selects: InStatement[] = [
        {
          sql: `SELECT dua_seq, dua_title, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref
                  FROM ${real} WHERE dua_ID = ? ORDER BY dua_seq`,
          args: [editId],
        },
      ]
      if (twin) {
        selects.push({
          sql: `SELECT dua_seq, dua_title FROM ${twin} WHERE dua_ID = ? ORDER BY dua_seq`,
          args: [editId],
        })
      }
      const selected = await db.batch(selects, 'read')
      const groupRows = selected[0].rows as any[]
      const twinRows = twin ? (selected[1].rows as any[]) : []

      const keySeq = parsedKey?.seq ?? null
      // The old code fell back to the first row when the exact key was gone.
      const row =
        (keySeq !== null ? groupRows.find(r => Number(r.dua_seq) === keySeq) : undefined) ||
        groupRows[0]
      if (!row) return error('Dua not found', 404)

      const oldSeq = Number(row.dua_seq)
      const newSeq = requestedSeq === null ? oldSeq : requestedSeq
      const newKey = duaKey(table, editId, newSeq)
      const seqChanged = oldSeq !== newSeq

      const titleChanged = groupRows.some(r => getText(r.dua_title) !== title)
      const twinTitleChanged = twinRows.some(r => getText(r.dua_title) !== title)
      const contentChanged =
        seqChanged ||
        getText(row.dua_desc) !== desc ||
        getText(row.dua_arabic) !== arabic ||
        getText(row.dua_urdu) !== urdu ||
        getText(row.dua_eng) !== english ||
        getText(row.dua_ref) !== ref

      const overrideMap = await getDuaOverrideMap()
      const existing = overrideMap.get(newKey)
      const needsFullOverride =
        seqChanged ||
        contentChanged ||
        titleChanged ||
        !existing ||
        existing.deleted ||
        existing.title !== title ||
        (existing.desc ?? getText(row.dua_desc)) !== desc ||
        (existing.arabic ?? getText(row.dua_arabic)) !== arabic ||
        (existing.urdu ?? getText(row.dua_urdu)) !== urdu ||
        (existing.english ?? getText(row.dua_eng)) !== english ||
        (existing.ref ?? getText(row.dua_ref)) !== ref

      const writes: InStatement[] = []
      const overlayWrites: InStatement[] = []

      // Only touch columns that actually differ.
      if (titleChanged) {
        writes.push({ sql: `UPDATE ${real} SET dua_title = ? WHERE dua_ID = ?`, args: [title, editId] })
      }
      if (twin && twinTitleChanged) {
        writes.push({ sql: `UPDATE ${twin} SET dua_title = ? WHERE dua_ID = ?`, args: [title, editId] })
      }
      if (contentChanged) {
        writes.push({
          sql: `UPDATE ${real}
                   SET dua_seq = ?, dua_desc = ?, dua_arabic = ?, dua_urdu = ?, dua_eng = ?, dua_ref = ?
                 WHERE dua_ID = ? AND dua_seq = ?`,
          args: [newSeq, desc, arabic, urdu, english, ref, editId, oldSeq],
        })
      }

      // Keep the static-file overlay in sync only where it would differ.
      if (seqChanged) {
        overlayWrites.push(duaDeleteOverrideStatement(table, editId, oldSeq))
      }
      if (needsFullOverride) {
        overlayWrites.push(
          duaOverrideStatement({
            key: newKey,
            table,
            id: editId,
            seq: newSeq,
            title,
            desc,
            arabic,
            urdu,
            english,
            ref,
            deleted: false,
          })
        )
      }

      // Title-only overrides for the rest of the topic group.
      const titleOverridesNeeded =
        titleChanged ||
        groupRows.some(r => {
          const seq = Number(r.dua_seq)
          return seq !== newSeq && overrideMap.get(duaKey(table, editId, seq))?.title !== title
        })
      if (titleOverridesNeeded) {
        for (const r of groupRows) {
          const seq = Number(r.dua_seq)
          // `groupRows` was read before the seq update, so the row that moved
          // still appears under its old sequence. Its tombstone must win.
          if (seq === newSeq || (seqChanged && seq === oldSeq)) continue
          const current = overrideMap.get(duaKey(table, editId, seq))
          if (current && !current.deleted && current.title === title) continue
          overlayWrites.push(duaTitleOverrideStatement(table, editId, seq, title))
        }
      }

      if (twin) {
        const twinOverridesNeeded =
          twinTitleChanged ||
          twinRows.some(r => overrideMap.get(duaKey(twin, editId, Number(r.dua_seq)))?.title !== title)
        if (twinOverridesNeeded) {
          for (const r of twinRows) {
            const seq = Number(r.dua_seq)
            const current = overrideMap.get(duaKey(twin, editId, seq))
            if (current && !current.deleted && current.title === title) continue
            overlayWrites.push(duaTitleOverrideStatement(twin, editId, seq, title))
          }
        }
      }

      if (writes.length || overlayWrites.length) {
        if (overlayWrites.length) await ensureDuaOverrides()
        const batch = [...writes, ...overlayWrites]
        await db.batch(batch, 'write')
        if (overlayWrites.length) invalidateDuaOverrides()
      }

      return json({ success: true, action: 'updated', id: editId, seq: newSeq, key: newKey, table })
    }

    // New topic/content row. MAX() + INSERT + RETURNING is one round trip.
    const newSeq = requestedSeq ?? 1
    const inserted = await db.execute({
      sql: `INSERT INTO ${real} (dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref)
            SELECT COALESCE(MAX(dua_ID),0) + 1, ?, ?, ?, ?, ?, ?, ? FROM ${real}
            RETURNING dua_ID`,
      args: [title, newSeq, desc, arabic, urdu, english, ref],
    })
    const newId = Number(inserted.rows[0]?.dua_ID)
    if (!newId) return error('Failed to create dua', 500)

    await saveDuaOverride({
      key: duaKey(table, newId, newSeq),
      table,
      id: newId,
      seq: newSeq,
      title,
      desc,
      arabic,
      urdu,
      english,
      ref,
      deleted: false,
    })

    return json({ success: true, action: 'inserted', id: newId, seq: newSeq, key: duaKey(table, newId, newSeq), table })
  } catch (e: any) {
    return error(e.message || 'Failed to save dua', 500)
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdminRequest(req)) return error('Unauthorized', 401)
  try {
    const body = await req.json()
    const table = clean(body.table)
    const parsedKey = parseDuaKey(body.key)
    const id = parsedKey?.id ?? numOrNull(body.id)
    const seq = parsedKey?.seq ?? numOrNull(body.seq)
    if (!isDuaTable(table)) return error('invalid table', 400)
    if (id === null) return error('id required', 400)

    const db = createQuranClient()
    const real = resolveDuaTable(table)

    const rows = seq === null
      ? await query(db, `SELECT dua_seq FROM ${real} WHERE dua_ID = ?`, [id])
      : await query(db, `SELECT dua_seq FROM ${real} WHERE dua_ID = ? AND dua_seq = ?`, [id, seq])
    if (!rows.length) return error('Dua not found', 404)

    // Tombstones and the row delete are committed in one transaction.
    const overrideMap = await getDuaOverrideMap()
    const statements: InStatement[] = []
    for (const r of rows) {
      const rowSeq = Number(r.dua_seq)
      const current = overrideMap.get(duaKey(table, id, rowSeq))
      if (!current || !current.deleted) {
        statements.push(duaDeleteOverrideStatement(table, id, rowSeq))
      }
    }
    statements.push(
      seq === null
        ? { sql: `DELETE FROM ${real} WHERE dua_ID = ?`, args: [id] }
        : { sql: `DELETE FROM ${real} WHERE dua_ID = ? AND dua_seq = ?`, args: [id, seq] }
    )

    if (statements.length > 1) await ensureDuaOverrides()
    await db.batch(statements, 'write')
    invalidateDuaOverrides()

    return json({ success: true, deleted: rows.length })
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}
