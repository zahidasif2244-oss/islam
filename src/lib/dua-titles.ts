/**
 * Dua row identity + title helpers.
 *
 * A "dua" row is not unique by `dua_ID`: one topic/title owns several content
 * rows, distinguished by `dua_seq` (1..n). The composite
 * `source:dua_ID:dua_seq` key is unique in the baked file and is what the admin
 * overlay uses to match an edited row against the static list.
 *
 * Some legacy tables (notably `tbl_dua`) store English topic titles, while the
 * parallel `tbl_dua_Urdu` table holds the Urdu title for the same `dua_ID`.
 * Titles must always render in Urdu, so the normaliser below:
 *   - replaces Latin/English titles with the matching Urdu title when there is
 *     one for the same ID,
 *   - fills empty titles (several groups repeat the topic title on the first
 *     row only) from the first non-empty title in the same group.
 *
 * It is deliberately pure so both the browser and the server can use it.
 */

export type DuaKeyParts = { table: string; id: number; seq: number }

export function duaKey(source: string, id: number | string, seq: number | string): string {
  return `${String(source || '')}:${Number(id)}:${Number(seq)}`
}

export function parseDuaKey(key: unknown): DuaKeyParts | null {
  const raw = String(key || '').trim()
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length < 3) return null
  const seq = Number(parts.pop())
  const id = Number(parts.pop())
  const table = parts.join(':')
  if (!table || !Number.isFinite(id) || !Number.isFinite(seq)) return null
  return { table, id, seq }
}

export function duaRowKey(row: any): string {
  if (row && typeof row.key === 'string' && row.key.trim()) return row.key.trim()
  const source = row?.source ?? row?.table ?? row?.table_name ?? ''
  const id = row?.id ?? row?.dua_ID ?? row?.dua_id ?? ''
  const seq = row?.seq ?? row?.dua_seq ?? ''
  return duaKey(source, id, seq)
}

/** Urdu/Persian/Arabic script — everything the UI renders with the Urdu font. */
export function hasUrduScript(text: unknown): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || ''))
}

export function hasLatinScript(text: unknown): boolean {
  return /[A-Za-z]/.test(String(text || ''))
}

/**
 * Return rows with every title in Urdu where possible.
 * Rows are not mutated; a new array is returned so React state updates cleanly.
 */
export function normalizeDuaTitles<T extends Record<string, any>>(rows: T[]): T[] {
  const list = Array.isArray(rows) ? rows : []

  // `tbl_dua_Urdu` is the Urdu-title source of truth for duplicate IDs that
  // also exist in `tbl_dua`.
  const urduById = new Map<string, string>()
  for (const row of list) {
    if (String(row?.source || '') !== 'tbl_dua_Urdu') continue
    const id = String(row?.id ?? '')
    const title = String(row?.title || '').trim()
    if (!id || !title || urduById.has(id)) continue
    if (hasUrduScript(title) && !hasLatinScript(title)) urduById.set(id, title)
  }

  // First non-empty Urdu title in each source+ID group (for repeated rows whose
  // title column was only filled on the first row).
  const groupTitle = new Map<string, string>()
  for (const row of list) {
    const id = String(row?.id ?? '')
    const source = String(row?.source || '')
    if (!id || !source) continue
    const title = String(row?.title || '').trim()
    if (!title || !hasUrduScript(title) || hasLatinScript(title)) continue
    const key = `${source}:${id}`
    if (!groupTitle.has(key)) groupTitle.set(key, title)
  }

  return list.map(row => {
    const title = String(row?.title || '').trim()
    if (title && hasUrduScript(title) && !hasLatinScript(title)) {
      return { ...row, key: duaRowKey(row) }
    }

    const id = String(row?.id ?? '')
    const source = String(row?.source || '')
    const fallback =
      urduById.get(id) ||
      groupTitle.get(`${source}:${id}`) ||
      ''

    return {
      ...row,
      title: fallback || row?.title || '',
      key: duaRowKey(row),
    }
  })
}
