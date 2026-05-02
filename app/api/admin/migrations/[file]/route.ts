/**
 * GET /api/admin/migrations/[file]
 *
 * Returns the raw SQL content of a single migration in supabase/migrations/.
 * Used by the /health page to power one-click "Copy SQL" → paste into the
 * Supabase SQL editor flow when a column / table is missing.
 *
 * Auth: only signed-in users (the (app) layout enforces exec role for any UI
 * route, but this is an API endpoint so we re-check). Pure-read, no execution.
 *
 * Path validation: filename must match `\d{3}[_-][a-z0-9_-]+\.sql` and resolve
 * inside supabase/migrations — defends against path traversal.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const VALID_FILE = /^[0-9]{3}[_-][a-z0-9_-]+\.sql$/i

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { file } = await params
  if (!VALID_FILE.test(file)) {
    return NextResponse.json(
      { error: 'Invalid migration filename. Expected ###_name.sql' },
      { status: 400 }
    )
  }

  const repoRoot = process.cwd()
  const dir = path.join(repoRoot, 'supabase', 'migrations')
  const target = path.join(dir, file)
  // Defense in depth: ensure resolved path is still under the migrations dir.
  if (!target.startsWith(dir + path.sep)) {
    return NextResponse.json({ error: 'Path escape rejected' }, { status: 400 })
  }

  try {
    const sql = await fs.readFile(target, 'utf8')
    return new NextResponse(sql, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'Content-Disposition': `inline; filename="${file}"`,
      },
    })
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: `Migration not found: ${file}` }, { status: 404 })
    }
    return NextResponse.json(
      { error: err.message || 'Could not read migration' },
      { status: 500 }
    )
  }
}
