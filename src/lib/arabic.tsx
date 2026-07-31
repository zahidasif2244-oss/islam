const SKIP_RE = /[\u0610-\u061A\u0621\u0640\u064B-\u0670\u06D6-\u06ED\u0660-\u0669\u06F0-\u06F9\uFD3E\uFD3F\u06E5\u06E6]/

const CHAR_MAP: Record<string, string> = {
  '\u0671': '\u0627', '\u0622': '\u0627', '\u0623': '\u0627', '\u0625': '\u0627',
  '\u0624': '\u0648', '\u0626': '\u064A', '\u0649': '\u064A',
  '\u0629': '\u0647', '\u06C3': '\u0647', '\u06C1': '\u0647', '\u06BE': '\u0647',
  '\u06AA': '\u0643', '\u06A9': '\u0643', '\u06CC': '\u064A', '\u06D2': '\u064A',
  '\u06BA': '\u0646', '\uFDF2': '\u0627\u0644\u0644\u0647',
}

const TA_MARBUTA = new Set(['\u0629', '\u06C3'])

export type ArabicNorm = { text: string; map: number[] }

function buildNorm(text: string, supAlefToAlif: boolean): ArabicNorm {
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (SKIP_RE.test(ch)) {
      if (supAlefToAlif && ch === '\u0670') {
        norm += '\u0627'
        map.push(i)
      }
      continue
    }
    if (ch === '\u0648' && TA_MARBUTA.has(text[i + 1] || '')) {
      norm += '\u0627'
      map.push(i)
      continue
    }
    const mapped = CHAR_MAP[ch] || ch
    for (const m of mapped) {
      norm += m
      map.push(i)
    }
  }
  return { text: norm, map }
}

export function normalizeArabicVariants(text: string): [ArabicNorm, ArabicNorm] {
  return [buildNorm(text, true), buildNorm(text, false)]
}

function wordVariants(word: string): string[] {
  const [a, b] = normalizeArabicVariants(word)
  return [a.text, b.text]
}

export function normalizeArabic(text: string): ArabicNorm {
  return buildNorm(text, true)
}

function findRanges(norm: ArabicNorm, word: string, out: number[][]) {
  let from = 0
  while (from <= norm.text.length - word.length) {
    const i = norm.text.indexOf(word, from)
    if (i === -1) break
    out.push([norm.map[i], norm.map[i + word.length - 1] + 1])
    from = i + word.length
  }
}

function highlightArabicRanges(text: string, words: string[]): number[][] {
  const [normA, normB] = normalizeArabicVariants(text)
  const ranges: number[][] = []
  for (const raw of words) {
    if (!raw) continue
    const variants = wordVariants(raw).filter(Boolean)
    const seen = new Set<string>()
    for (const w of variants) {
      if (seen.has(w)) continue
      seen.add(w)
      findRanges(normA, w, ranges)
      findRanges(normB, w, ranges)
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: number[][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

export function highlightArabic(text: string, words: string[]) {
  const ranges = highlightArabicRanges(text, words)
  if (ranges.length === 0) return text
  const parts: any[] = []
  let cursor = 0
  ranges.forEach((r, i) => {
    if (r[0] > cursor) parts.push(text.slice(cursor, r[0]))
    parts.push(<mark key={`m${i}`} className="bg-[#e8b840]/40 text-[#1a5c3a] rounded px-0.5 font-medium">{text.slice(r[0], r[1])}</mark>)
    cursor = r[1]
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function arabicSnippet(text: string, words: string[], before = 55, after = 90) {
  const [normA, normB] = normalizeArabicVariants(text)
  const variants = words.filter(Boolean).map(wordVariants)
  let bestNorm: ArabicNorm | null = null
  let best = -1
  let bestLen = 0
  for (const v of variants) {
    for (const w of v) {
      if (!w) continue
      for (const norm of [normA, normB]) {
        const i = norm.text.indexOf(w)
        if (i > -1 && (best === -1 || i < best)) { best = i; bestLen = w.length; bestNorm = norm }
      }
    }
  }
  if (best === -1 || !bestNorm) return highlightArabic(text, words)
  const start = Math.max(0, bestNorm.map[best] - before)
  const end = Math.min(text.length, bestNorm.map[best + bestLen - 1] + 1 + after)
  const slice = text.slice(start, end)
  return (
    <span>
      {start > 0 ? <span className="text-[#999]">…</span> : null}
      {highlightArabic(slice, words)}
      {end < text.length ? <span className="text-[#999]">…</span> : null}
    </span>
  )
}
