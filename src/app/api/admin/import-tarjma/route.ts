import { createQuranClient, run, getText } from '@/lib/db'
import { json, error } from '@/lib/api-utils'
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const BASE = process.cwd()

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
    const dataTable = tableNames.includes('translation') ? 'translation' : tableNames.find((t: string) => t.toLowerCase().includes('translat') || t.toLowerCase().includes('tarjma') || t.toLowerCase().includes('tarjama')) || tableNames[0] || 'translation'

    const tRows = srcDb.exec(`SELECT "SurahNumber", "AyahNumber", "Translation" FROM "${dataTable}" ORDER BY "SurahNumber", "AyahNumber"`)
    if (tRows.length === 0 || tRows[0].values.length === 0) return error('No data found - expected columns: SurahNumber, AyahNumber, Translation')

    const data = tRows[0].values.map((r: any) => ({
      surah: parseInt(getText(r[0])),
      ayah: parseInt(getText(r[1])),
      text: getText(r[2])
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