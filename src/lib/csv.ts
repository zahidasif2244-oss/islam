/**
 * Small browser-side CSV helpers for the admin export buttons.
 *
 * Exports are generated from data the admin pages already loaded, so they make
 * no extra API or database calls. A UTF-8 BOM keeps Urdu/Arabic readable in
 * Excel, and CRLF line endings match the existing import files.
 */

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map(row => row.map(csvCell).join(','))
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/**
 * Parse CSV text into rows of cells. Handles quoted fields, escaped quotes and
 * embedded newlines, which the one-line splitters used by older admin pages did
 * not. Empty lines are dropped and a UTF-8 BOM is ignored.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          current += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(current)
      current = ''
    } else if (ch === '\n') {
      row.push(current)
      rows.push(row)
      row = []
      current = ''
    } else if (ch !== '\r') {
      current += ch
    }
  }

  if (current !== '' || row.length > 0) {
    row.push(current)
    rows.push(row)
  }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const blob = new Blob([buildCsv(header, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
