/**
 * Collects every character that can be rendered with the Urdu (Nastaliq)
 * web fonts, so `pyftsubset` can produce a font that is 10-30x smaller
 * than the full 9-10 MB originals.
 *
 * Sources scanned:
 *   - every JSON file under src/data (quran, hadith, duas, topics, ...)
 *   - every .ts/.tsx file under src (hard-coded UI strings)
 *
 * Output: scripts/font-charset.txt (one line, sorted, unique)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'src', 'data')
const SRC_DIR = path.join(ROOT, 'src')
const OUT = path.join(ROOT, 'scripts', 'font-charset.txt')

const chars = new Set()

function addString(s) {
  if (typeof s !== 'string' || !s) return
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    // Arabic / Urdu script blocks + Arabic presentation forms + ZWJ/ZWNJ
    if (
      (cp >= 0x0600 && cp <= 0x06ff) ||
      (cp >= 0x0750 && cp <= 0x077f) ||
      (cp >= 0x08a0 && cp <= 0x08ff) ||
      (cp >= 0xfb50 && cp <= 0xfdff) ||
      (cp >= 0xfe70 && cp <= 0xfeff) ||
      cp === 0x200c ||
      cp === 0x200d ||
      (cp >= 0x20 && cp <= 0x7e)
    ) {
      chars.add(ch)
    }
  }
}

function walk(dir, filter) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, filter))
    else if (filter(full)) out.push(full)
  }
  return out
}

// 1) JSON data
let jsonCount = 0
for (const file of walk(DATA_DIR, f => f.endsWith('.json'))) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }
  // Fast path: pull every quoted string without fully parsing huge files.
  for (const m of raw.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    addString(m[1])
  }
  jsonCount++
}

// 2) Source code (UI strings, CSS font stacks, etc.)
let srcCount = 0
for (const file of walk(SRC_DIR, f => /\.(tsx?|jsx?|css)$/.test(f))) {
  addString(fs.readFileSync(file, 'utf8'))
  srcCount++
}

const sorted = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
fs.writeFileSync(OUT, sorted.join(''), 'utf8')

console.log(`scanned ${jsonCount} json files, ${srcCount} source files`)
console.log(`unique characters: ${sorted.length}`)
console.log(`sample: ${sorted.slice(0, 60).join('')}`)
console.log(`written: ${OUT}`)
