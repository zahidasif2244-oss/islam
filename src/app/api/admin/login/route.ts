import { NextResponse } from 'next/server'
import { json, error } from '@/lib/api-utils'
import { checkAdminLogin, isAdminConfigured, sessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return error('Admin login is not configured on this server', 500)
  }
  let body: any = {}
  try {
    body = await req.json()
  } catch {}
  const email = String(body.email || '').trim()
  const password = String(body.password || '')
  if (!checkAdminLogin(email, password)) {
    return error('Invalid email or password', 401)
  }
  const res: NextResponse = json({ success: true })
  res.headers.set('Set-Cookie', sessionCookie(email))
  return res
}