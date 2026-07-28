import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public')
  const entries = fs.readdirSync(publicDir, { withFileTypes: true })
  const folders = entries
    .filter(e => e.isDirectory() && e.name !== 'fonts')
    .map(e => ({
      name: e.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      url: `/${e.name}/index.html`
    }))
  return NextResponse.json(folders)
}
