import { json } from '@/lib/api-utils'
import { clearSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = json({ success: true })
  res.headers.set('Set-Cookie', clearSessionCookie())
  return res
}