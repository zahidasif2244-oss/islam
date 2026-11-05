/**
 * Pure merge helpers for the baked topic lists and the Turso admin overlay.
 *
 * `public/data/static/topics.json` and `amazing_topics.json` stay on the CDN.
 * Admin edits are stored in `tbl_TopicOverrides` and applied on top of those
 * files in the browser. Keeping this module dependency-free also lets the
 * admin page reuse it without pulling in the Quran search bundle.
 */

export type TopicKind = 'topics' | 'amazing'

export const TOPIC_KINDS: TopicKind[] = ['topics', 'amazing']

export function isTopicKind(value: unknown): value is TopicKind {
  return value === 'topics' || value === 'amazing'
}

export function topicRowKey(kind: string, id: unknown): string {
  return `${kind}:${Number(id)}`
}

export type NormalizedTopic = {
  surah: number
  surah_name: string
  start_ayah: number | null
  end_ayah: number | null
  ayah: number | null
  para: number | null
  urdu: string
  english: string
}

export type TopicValidation =
  | { ok: true; value: NormalizedTopic }
  | { ok: false; error: string }

function wholeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

function cleanText(value: unknown, max = 20000): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\r\n/g, '\n').trim().slice(0, max)
}

/**
 * Validate and normalise a topic row. Shared by the admin page, the single-row
 * API and the CSV importer so all three accept exactly the same data.
 */
export function normalizeTopic(kind: TopicKind, raw: any): TopicValidation {
  if (!isTopicKind(kind)) {
    return { ok: false, error: 'Choose the Topics or Amazing tab.' }
  }

  const surah = wholeNumber(raw?.surah)
  if (surah === null || surah < 1 || surah > 114) {
    return { ok: false, error: 'Surah must be a whole number between 1 and 114.' }
  }

  const urdu = cleanText(raw?.urdu)
  const english = cleanText(raw?.english)
  if (!urdu && !english) {
    return { ok: false, error: 'Enter Urdu or English text.' }
  }

  if (kind === 'topics') {
    const start = wholeNumber(raw?.start_ayah)
    const end = wholeNumber(raw?.end_ayah)
    const para = wholeNumber(raw?.para)
    if (start === null || start < 0 || start > 285) {
      return { ok: false, error: 'Start ayah must be a whole number between 0 and 285.' }
    }
    if (end === null || end < start || end > 286) {
      return { ok: false, error: 'End ayah must be between the start ayah and 286.' }
    }
    if (para === null || para < 1 || para > 30) {
      return { ok: false, error: 'Para must be a whole number between 1 and 30.' }
    }
    return {
      ok: true,
      value: {
        surah,
        surah_name: cleanText(raw?.surah_name, 200),
        start_ayah: start,
        end_ayah: end,
        ayah: null,
        para,
        urdu,
        english,
      },
    }
  }

  const ayah = wholeNumber(raw?.ayah)
  if (ayah === null || ayah < 1 || ayah > 286) {
    return { ok: false, error: 'Ayah must be a whole number between 1 and 286.' }
  }
  return {
    ok: true,
    value: {
      surah,
      surah_name: '',
      start_ayah: null,
      end_ayah: null,
      ayah,
      para: null,
      urdu,
      english,
    },
  }
}

const present = (v: unknown) => v !== null && v !== undefined

/** Apply an override's non-null fields to a baked row. */
export function applyTopicOverride(base: any, override: any, kind: TopicKind): any {
  const out: any = { ...base }
  if (present(override.id)) out.id = Number(override.id)
  if (present(override.surah)) out.surah = Number(override.surah)
  if (present(override.urdu)) out.urdu = String(override.urdu)
  if (present(override.english)) out.english = String(override.english)

  if (kind === 'topics') {
    if (present(override.surah_name)) out.surah_name = String(override.surah_name)
    if (present(override.start_ayah)) out.start_ayah = Number(override.start_ayah)
    if (present(override.end_ayah)) out.end_ayah = Number(override.end_ayah)
    if (present(override.para)) out.para = Number(override.para)
  } else if (present(override.ayah)) {
    out.ayah = Number(override.ayah)
  }

  return out
}

/** Build a row for an admin-created topic from an override record. */
export function topicFromOverride(override: any, kind: TopicKind): any {
  const out: any = {
    id: Number(override.id),
    surah: present(override.surah) ? Number(override.surah) : 1,
    urdu: override.urdu ?? '',
    english: override.english ?? '',
  }

  if (kind === 'topics') {
    out.surah_name = override.surah_name ?? ''
    out.start_ayah = present(override.start_ayah) ? Number(override.start_ayah) : 0
    out.end_ayah = present(override.end_ayah) ? Number(override.end_ayah) : out.start_ayah
    out.para = present(override.para) ? Number(override.para) : 1
  } else {
    out.ayah = present(override.ayah) ? Number(override.ayah) : 1
  }

  return out
}

/** Keep the public list in the same surah/ayah order as the baked files. */
export function sortTopics(list: any[], kind: TopicKind): any[] {
  const position = kind === 'topics' ? 'start_ayah' : 'ayah'
  return [...list].sort((a, b) => {
    const surahA = Number(a?.surah) || 0
    const surahB = Number(b?.surah) || 0
    if (surahA !== surahB) return surahA - surahB

    const posA = Number(a?.[position]) || 0
    const posB = Number(b?.[position]) || 0
    if (posA !== posB) return posA - posB

    return (Number(a?.id) || 0) - (Number(b?.id) || 0)
  })
}

/**
 * Merge one tab's baked rows with the overlay.
 * Deleted baked rows are removed, edited rows are replaced field-by-field, and
 * custom rows are appended then sorted into their proper place.
 */
export function mergeTopicOverrides(base: any[], overrides: any[], kind: TopicKind): any[] {
  const list = Array.isArray(base) ? base : []
  const rows = (Array.isArray(overrides) ? overrides : []).filter(o => o && o.kind === kind)

  if (rows.length === 0) return sortTopics(list, kind)

  const byKey = new Map<string, any>()
  for (const o of rows) byKey.set(topicRowKey(kind, o.id), o)

  const seen = new Set<string>()
  const out: any[] = []

  for (const item of list) {
    const key = topicRowKey(kind, item?.id)
    seen.add(key)
    const override = byKey.get(key)
    if (override?.deleted) continue
    out.push(override ? applyTopicOverride(item, override, kind) : item)
  }

  for (const override of rows) {
    if (override?.deleted) continue
    const key = topicRowKey(kind, override.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(topicFromOverride(override, kind))
  }

  return sortTopics(out, kind)
}
