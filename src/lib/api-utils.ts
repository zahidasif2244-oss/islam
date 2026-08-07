import { NextResponse } from 'next/server'
import { decodeUrdu, getText } from './db'
import { COL_IS_URDU } from './constants'

export function json<T>(data: T, status = 200, cacheSec = 0) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cacheSec > 0) {
    headers['cache-control'] = `public, s-maxage=${cacheSec}, max-age=${cacheSec}, stale-while-revalidate=${cacheSec * 2}`
  } else {
    headers['cache-control'] = 'no-store'
  }
  return NextResponse.json(data, { status, headers })
}

export function error(msg: string, status = 404) {
  return NextResponse.json({ error: msg }, { status })
}

export function getColumnText(col: string, val: unknown): string {
  if (val === null || val === undefined) return ''
  if (COL_IS_URDU[col]) return decodeUrdu(val)
  return getText(val)
}
