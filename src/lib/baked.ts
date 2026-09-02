import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'src', 'data')

const fileCache = new Map<string, any>()

export function loadJson<T = any>(relativePath: string): T | null {
  if (fileCache.has(relativePath)) return fileCache.get(relativePath)
  try {
    const fullPath = path.join(dataDir, relativePath)
    const raw = fs.readFileSync(fullPath, 'utf-8')
    const data = JSON.parse(raw)
    fileCache.set(relativePath, data)
    return data
  } catch {
    return null
  }
}

export function loadSurah(id: number): any[] | null {
  return loadJson<any[]>(`quran/surah-${id}.json`)
}

export function loadWbw(surah: number): Record<number, any[]> | null {
  return loadJson(`quran/wbw-${surah}.json`)
}

export function loadAWords(surah: number): Record<number, any[]> | null {
  return loadJson(`quran/awords-${surah}.json`)
}

export function loadSearchIndex(): any[] {
  return loadJson<any[]>('static/search-index.json') || []
}
