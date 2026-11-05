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
