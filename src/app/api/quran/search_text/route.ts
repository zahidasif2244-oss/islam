import { json, error } from '@/lib/api-utils'
import { loadSearchIndex } from '@/lib/baked'
import { normalizeArabicVariants } from '@/lib/arabic'
import { quranWords, arabicQuranMatches, encodeUrduPhrase } from '@/lib/quran-search'

function decodeUrdu(text: string): string {
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

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  const lang = url.searchParams.get('lang') || 'urdu'
  if (!q.trim()) return error('Search query required', 400)

  const index = loadSearchIndex()
  const { typedWords, phrase, words } = quranWords(q)
  if (words.length === 0) return json([])

  if (lang === 'arabic') {
    const normPhrases = normalizeArabicVariants(phrase).map(v => v.text).filter(Boolean)
    const rows = arabicQuranMatches(index, words, normPhrases)
    return json(rows.slice(0, 100).map(r => ({
      id: r.id, surah: r.surah, ayah: r.ayah,
      arabic: r.arabic, urdu: decodeUrdu(r.urdu || ''), english: r.english, roman_urdu: r.roman_urdu,
      searchWords: typedWords,
      match_count: r.count,
      total_words: typedWords.length,
      phrase_match: r.arabicPhrase,
    })))
  }

  const phraseEnc = encodeUrduPhrase(phrase)
  const urduRows: any[] = []
  for (const r of index) {
    const urduFlags = words.map(w => r.urE && r.urE.includes(w.enc) ? 1 : 0)
    const count = urduFlags.reduce((a: number, b: number) => a + b, 0)
    if (!count) continue
    urduRows.push({
      id: r.id, surah: r.s, ayah: r.a,
      arabic: r.ar, urdu: decodeUrdu(r.ur),
      english: r.en, roman_urdu: r.ro,
      urduFlags, urduPhrase: r.urE && r.urE.includes(phraseEnc) ? 1 : 0,
    })
  }

  return json(urduRows.slice(0, 100).map(r => ({
    id: r.id, surah: r.surah, ayah: r.ayah,
    arabic: r.arabic, urdu: r.urdu, english: r.english, roman_urdu: r.roman_urdu,
    searchWords: typedWords,
    match_count: r.urduFlags.reduce((a: number, b: number) => a + b, 0),
    total_words: typedWords.length,
    phrase_match: r.urduPhrase,
  })))
}
