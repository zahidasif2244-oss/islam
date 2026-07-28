import { createClient } from '@libsql/client'
import type { Client } from '@libsql/client'

function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

const quranClientCache = new Map<string, Client>()

export function createQuranClient(): Client {
  const key = 'quran'
  let c = quranClientCache.get(key)
  if (!c) {
    c = createClient({ url: getEnv('TURSO_QURAN_DB_URL'), authToken: getEnv('TURSO_QURAN_DB_TOKEN') })
    quranClientCache.set(key, c)
  }
  return c
}

const hadithClientCache = new Map<string, Client>()

export function createHadithClient(bookId: string): Client {
  const key = `TURSO_HADITH_${bookId.toUpperCase()}_DB_URL`
  let c = hadithClientCache.get(key)
  if (!c) {
    const tokenKey = `TURSO_HADITH_${bookId.toUpperCase()}_DB_TOKEN`
    c = createClient({ url: getEnv(key), authToken: getEnv(tokenKey) })
    hadithClientCache.set(key, c)
  }
  return c
}

export async function query(client: Client, sql: string, args?: any[]): Promise<Record<string, any>[]> {
  const result = await client.execute({ sql, args })
  return result.rows
}

export async function queryOne(client: Client, sql: string, args?: any[]): Promise<Record<string, any> | null> {
  const rows = await query(client, sql, args)
  return rows[0] || null
}

export async function run(client: Client, sql: string, args?: any[]): Promise<void> {
  await client.execute({ sql, args })
}

export function getText(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Uint8Array) return new TextDecoder('utf-8').decode(val)
  return String(val)
}

export function decodeUrdu(encrypted: unknown): string {
  const text = getText(encrypted)
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

export function cleanUrdu(urduText: unknown, romanText: unknown): string {
  const decoded = decodeUrdu(urduText)
  if (decoded) return decoded
  const roman = getText(romanText)
  if (roman) return roman
  return getText(urduText)
}
