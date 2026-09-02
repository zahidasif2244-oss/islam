export function encodeUrdu(text: string): string {
  let result = ''
  for (const c of text) {
    const cp = c.charCodeAt(0)
    if (cp >= 0x600 && cp <= 0x6FF) {
      let newCp = cp + 3
      if (newCp > 0x6FF) newCp = 0x600 + (newCp - 0x6FF - 1)
      result += String.fromCharCode(newCp)
    } else result += c
  }
  return result
}

export function encodeUrduPhrase(phrase: string): string {
  return encodeUrdu(phrase)
}

export interface QuranSearchWord {
  raw: string
  enc: string
  norm: string[]
}

import { normalizeArabicVariants } from '@/lib/arabic'

export function quranWords(q: string): { typedWords: string[]; phrase: string; words: QuranSearchWord[] } {
  const typedWords = q.trim().split(/\s+/).filter(Boolean).slice(0, 8)
  const phrase = typedWords.join(' ')
  const words = typedWords.map(raw => ({
    raw,
    enc: encodeUrdu(raw),
    norm: normalizeArabicVariants(raw).map(v => v.text).filter(Boolean),
  }))
  return { typedWords, phrase, words }
}

export function arabicQuranMatches(index: any[], words: QuranSearchWord[], normPhrases: string[]): any[] {
  const out: any[] = []
  for (const r of index) {
    const arabicFlags = words.map(w => (w.norm.some(n => (r.normA || r.arN || '').includes(n)) ? 1 : 0))
    const count = arabicFlags.reduce<number>((a, b) => a + b, 0)
    if (!count) continue
    out.push({
      id: r.id, surah: r.surah || r.s, ayah: r.ayah || r.a,
      arabic: r.arabic || r.ar, urdu: r.urdu || r.ur, english: r.english || r.en, roman_urdu: r.roman_urdu || r.ro,
      arabicFlags, count,
      arabicPhrase: normPhrases.some(p => (r.normA || r.arN || '').includes(p)) ? 1 : 0,
    })
  }
  return out
}

function decodeUrduInline(text: string): string {
  if (!text) return ''
  let result = ''
  for (const c of text) {
    const cp = c.charCodeAt(0)
    if (cp === 0x0623 || cp === 13 || cp === 10) { result += ' '; continue }
    if (cp === 0x00AE || cp === 0x00BE) continue
    if (cp >= 33 && cp <= 126) { result += c; continue }
    if (cp >= 0x600 && cp <= 0x6FF) {
      let newCp = cp - 3
      if (newCp < 0x600) newCp = 0x6FF - (0x600 - newCp) + 1
      result += String.fromCharCode(newCp)
    }
  }
  return result.replace(/\?d\s*\S+@\S+/g, '').replace(/\?2dA/g, '').replace(/\r/g, ' ').replace(/ +/g, ' ').trim()
}

export function mergeQuranHits(urduRows: any[], arabicRows: any[], typedWords: string[], totalWords: number): any[] {
  const map = new Map<number, any>()
  for (const r of urduRows) {
    map.set(r.id, { ...r, flags: r.urduFlags, phrase: r.urduPhrase, matchedUrdu: 1 })
  }
  for (const r of arabicRows) {
    const existing = map.get(r.id)
    if (existing) {
      existing.flags = existing.flags.map((f: number, i: number) => f || r.arabicFlags[i])
      existing.phrase = existing.phrase || r.arabicPhrase
      if (!existing.matchedUrdu) { existing.arabic = r.arabic; existing.urdu = decodeUrduInline(r.urdu) }
    } else {
      map.set(r.id, { ...r, flags: r.arabicFlags, phrase: r.arabicPhrase, urdu: decodeUrduInline(r.urdu) })
    }
  }
  const out: any[] = []
  for (const r of map.values()) {
    const match_count = r.flags.reduce((a: number, b: number) => a + b, 0)
    out.push({
      id: r.id, surah: r.surah, ayah: r.ayah,
      arabic: r.arabic, urdu: r.urdu, english: r.english, roman_urdu: r.roman_urdu,
      searchWords: typedWords,
      match_count, total_words: totalWords,
      phrase_match: r.phrase ? 1 : 0,
    })
  }
  out.sort((a, b) => b.phrase_match - a.phrase_match || b.match_count - a.match_count || a.arabic.length - b.arabic.length)
  return out.slice(0, 100)
}
