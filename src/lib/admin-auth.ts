import { createHmac, timingSafeEqual } from 'crypto'

export const ADMIN_COOKIE = 'quranweb_admin'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

export function adminEnv() {
  return {
    email: process.env.ADMIN_EMAIL || '',
    pass: process.env.ADMIN_PASS || '',
    secret: process.env.ADMIN_SECRET || '',
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function sign(payload: string): string {
  const sig = createHmac('sha256', adminEnv().secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function issueToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_MS })).toString('base64url')
  return sign(payload)
}

function verifyToken(token: string): { email: string } | null {
  if (!token || !adminEnv().secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  const expect = createHmac('sha256', adminEnv().secret).update(payload).digest()
  const got = Buffer.from(sig, 'base64url')
  if (expect.length !== got.length) return null
  if (!timingSafeEqual(expect, got)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.email || typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return { email: data.email }
  } catch {
    return null
  }
}

function readCookie(req: Request, name: string): string {
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return part.slice(i + 1).trim()
      }
    }
  }
  return ''
}

export function verifyAdminRequest(req: Request): boolean {
  return !!verifyToken(readCookie(req, ADMIN_COOKIE))
}

export function isAdminConfigured(): boolean {
  const { email, pass, secret } = adminEnv()
  return !!(email && pass && secret)
}

export function checkAdminLogin(email: string, password: string): boolean {
  const { email: envEmail, pass: envPass } = adminEnv()
  return safeEqual(email, envEmail) && safeEqual(password, envPass)
}

export function sessionCookie(email: string): string {
  const token = issueToken(email)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${secure}`
}

export function clearSessionCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

