import { createQuranClient, run, query, queryOne, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { DUA_TABLES, DUA_COLS, isDuaTable, resolveDuaTable } from '@/lib/dua-tables'
import { duaKey, normalizeDuaTitles, parseDuaKey } from '@/lib/dua-titles'
import {
  deleteDuaOverride,
  getDuaOverrideMap,
  saveDuaOverride,
  saveDuaTitleOverride,
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

    // Fetch every category first so title normalisation can borrow the Urdu
    // title from tbl_dua_Urdu for the English-titled tbl_dua rows.
    const raw: Record<string, any[]> = {}
    await Promise.all(
      DUA_TABLES.map(async ([table]) => {
        raw[table] = await query(
          db,
          `SELECT ${DUA_COLS.join(',')} FROM ${resolveDuaTable(table)} ORDER BY dua_ID, dua_seq`
        )
      })
    )

    const overrideMap = await getDuaOverrideMap()
    const all: any[] = []

    for (const [table] of DUA_TABLES) {
      for (const r of raw[table] || []) {
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
      // Find the exact content row. The old code updated `WHERE dua_ID = ?`,
      // which rewrote *every* content row in the topic with one row's fields.
      let row: any = null
      const keySeq = parsedKey?.seq ?? null
      if (keySeq !== null) {
        row = await queryOne(
          db,
          `SELECT dua_ID, dua_seq FROM ${real} WHERE dua_ID = ? AND dua_seq = ? LIMIT 1`,
          [editId, keySeq]
        )
      }
      if (!row) {
        row = await queryOne(
          db,
          `SELECT dua_ID, dua_seq FROM ${real} WHERE dua_ID = ? ORDER BY dua_seq LIMIT 1`,
          [editId]
        )
      }
      if (!row) return error('Dua not found', 404)

      const oldSeq = Number(row.dua_seq)
      const newSeq = requestedSeq === null ? oldSeq : requestedSeq
      const oldKey = duaKey(table, editId, oldSeq)
      const newKey = duaKey(table, editId, newSeq)

      // Titles belong to the whole topic (dua_ID), so update every row in the
      // group — and in the parallel English/Urdu table when one exists.
      await run(db, `UPDATE ${real} SET dua_title = ? WHERE dua_ID = ?`, [title, editId])
      const twin = counterpartTable(table)
      if (twin) {
        await run(db, `UPDATE ${twin} SET dua_title = ? WHERE dua_ID = ?`, [title, editId])
      }

      // Everything else belongs to this one content row only.
      await run(
        db,
        `UPDATE ${real}
            SET dua_seq = ?, dua_desc = ?, dua_arabic = ?, dua_urdu = ?, dua_eng = ?, dua_ref = ?
          WHERE dua_ID = ? AND dua_seq = ?`,
        [newSeq, desc, arabic, urdu, english, ref, editId, oldSeq]
      )

      // Keep the CDN/static overlay in sync with the database write.
      if (oldSeq !== newSeq) await deleteDuaOverride(table, editId, oldSeq)
      await saveDuaOverride({
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

      // Title-only overrides for the remaining rows in this topic group.
      const groupRows = await query(
        db,
        `SELECT dua_seq FROM ${real} WHERE dua_ID = ? ORDER BY dua_seq`,
        [editId]
      )
      for (const gr of groupRows) {
        const s = Number(gr.dua_seq)
        if (s === newSeq) continue
        await saveDuaTitleOverride(table, editId, s, title)
      }

      // Mirror the topic title on the parallel table too.
      if (twin) {
        const twinRows = await query(
          db,
          `SELECT dua_seq FROM ${twin} WHERE dua_ID = ? ORDER BY dua_seq`,
          [editId]
        )
        for (const gr of twinRows) {
          await saveDuaTitleOverride(twin, editId, Number(gr.dua_seq), title)
        }
      }

      return json({ success: true, action: 'updated', id: editId, seq: newSeq, key: newKey, table })
    }

    // New topic/content row.
    const maxRows = await query(db, `SELECT COALESCE(MAX(dua_ID),0) AS m FROM ${real}`)
    const newId = Number((maxRows[0] as any).m) + 1
    const newSeq = requestedSeq ?? 1

    await run(
      db,
      `INSERT INTO ${real} (dua_ID, dua_title, dua_seq, dua_desc, dua_arabic, dua_urdu, dua_eng, dua_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, title, newSeq, desc, arabic, urdu, english, ref]
    )
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

    for (const r of rows) {
      await deleteDuaOverride(table, id, Number(r.dua_seq))
    }

    if (seq === null) {
      await run(db, `DELETE FROM ${real} WHERE dua_ID = ?`, [id])
    } else {
      await run(db, `DELETE FROM ${real} WHERE dua_ID = ? AND dua_seq = ?`, [id, seq])
    }

    return json({ success: true, deleted: rows.length })
  } catch (e: any) {
    return error(e.message || 'Delete failed', 500)
  }
}
