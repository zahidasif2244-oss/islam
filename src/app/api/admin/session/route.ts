import { json } from '@/lib/api-utils'
import { verifyAdminRequest } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return json({ authed: verifyAdminRequest(req) })
}