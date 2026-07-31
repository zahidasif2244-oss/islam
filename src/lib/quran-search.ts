import { query, getText, cleanUrdu } from '@/lib/db'
import { normalizeArabicVariants } from '@/lib/arabic'

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

let arabicIndex: any[] | null = null

export async function getArabicIndex(db: any) {
  if (arabicIndex) return arabicIndex
  const rows = await query(db, 'SELECT id, surat_id, ayat_number, arabic, translation_urdu, translation_english, translation_roman_urdu FROM tbl_QuranComplete')
  arabicIndex = rows.map(r => {
    const [normA, normB] = normalizeArabicVariants(getText(r.arabic))
    return {
      id: r.id, surah: r.surat_id, ayah: r.ayat_number,
      arabic: getText(r.arabic), urdu: cleanUrdu(r.translation_urdu, r.translation_roman_urdu),
      english: getText(r.translation_english), roman_urdu: getText(r.translation_roman_urdu),
      normA: normA.text, normB: normB.text,
    }
  })
  return arabicIndex
}

export interface QuranSearchWord {
  raw: string
  enc: string
  norm: string[]
}

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

export async function urduQuranMatches(db: any, words: QuranSearchWord[], phraseEnc: string): Promise<any[]> {
  if (words.length === 0) return []
  const flags = words.map((w, i) => `(CASE WHEN translation_urdu LIKE ? THEN 1 ELSE 0 END) AS u${i}`)
  const orConds = words.map(w => `translation_urdu LIKE ?`)
  const sql = `SELECT id, surat_id, ayat_number, arabic, translation_urdu, translation_english, translation_roman_urdu, ${flags.join(', ')}, (CASE WHEN translation_urdu LIKE ? THEN 1 ELSE 0 END) AS up FROM tbl_QuranComplete WHERE ${orConds.join(' OR ')}`
  const params: string[] = [...words.map(w => `%${w.enc}%`), `%${phraseEnc}%`, ...words.map(w => `%${w.enc}%`)]
  const rows = await query(db, sql, params)
  return rows.map(r => {
    const urduFlags = words.map((_, i) => Number(r[`u${i}`]))
    return {
      id: r.id, surah: r.surat_id, ayah: r.ayat_number,
      arabic: getText(r.arabic), urdu: cleanUrdu(r.translation_urdu, r.translation_roman_urdu),
      english: getText(r.translation_english), roman_urdu: getText(r.translation_roman_urdu),
      urduFlags, urduPhrase: Number(r.up),
    }
  })
}

export function arabicQuranMatches(index: any[], words: QuranSearchWord[], normPhrases: string[]): any[] {
  const out: any[] = []
  for (const r of index) {
    const arabicFlags = words.map(w => (w.norm.some(n => r.normA.includes(n) || r.normB.includes(n)) ? 1 : 0))
    const count = arabicFlags.reduce<number>((a, b) => a + b, 0)
    if (!count) continue
    out.push({
      id: r.id, surah: r.surah, ayah: r.ayah,
      arabic: r.arabic, urdu: r.urdu, english: r.english, roman_urdu: r.roman_urdu,
      arabicFlags, count,
      arabicPhrase: normPhrases.some(p => r.normA.includes(p) || r.normB.includes(p)) ? 1 : 0,
    })
  }
  return out
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
      if (!existing.matchedUrdu) { existing.arabic = r.arabic; existing.urdu = r.urdu }
    } else {
      map.set(r.id, { ...r, flags: r.arabicFlags, phrase: r.arabicPhrase })
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
