import { createQuranClient, run, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const BASE = process.cwd()

function cleanTafseerText(text: unknown): string {
  const s = getText(text)
  if (!s) return ''
  return s.replace(/-r-n/g, '\n').replace(/-n-/g, '\n').replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function POST(req: Request) {
  try {
    const { filename, columnName } = await req.json()
    if (!filename || !columnName) return error('filename and columnName required')

    const srcPath = path.join(BASE, 'assets', filename)
    if (!fs.existsSync(srcPath)) return error(`File not found: assets/${filename}`)

    const SQL = await initSqlJs()
    const srcDb = new SQL.Database(fs.readFileSync(srcPath))

    const tables = srcDb.exec("SELECT name FROM sqlite_master WHERE type='table'")
    const tableNames = tables.length > 0 ? tables[0].values.map((r: any) => getText(r[0])) : []
    const tafseerTable = tableNames.includes('tafseer') ? 'tafseer' : tableNames.find((t: string) => t.toLowerCase().includes('tafseer')) || tableNames[0] || 'tafseer'

    const tRows = srcDb.exec(`SELECT "SurahNumber", "AyahNumber", "Tafseer" FROM "${tafseerTable}" ORDER BY "SurahNumber", "AyahNumber"`)
    if (tRows.length === 0 || tRows[0].values.length === 0) return error('No data found in tafseer table')

    const data = tRows[0].values.map((r: any) => ({
      surah: parseInt(getText(r[0])),
      ayah: parseInt(getText(r[1])),
      text: cleanTafseerText(r[2])
    }))

    srcDb.close()

    const db = createQuranClient()
    let updated = 0

    for (const row of data) {
      if (!row.text) continue
      await run(db, `UPDATE tbl_QuranComplete SET "${columnName}" = ? WHERE surat_id = ? AND ayat_number = ?`, [row.text, row.surah, row.ayah])
      updated++
    }

    return json({ success: true, updated, total: data.length })
  } catch (e: any) {
    return error(e.message || 'Import failed')
  }
}