/**
 * GET /api/admin/migrations
 *
 * Returns the list of .sql files in supabase/migrations/ along with whether
 * each looks "applied" (defined as: every column the file CREATEs is present
 * on its target table). Best-effort heuristic — not a full migration tracker.
 *
 * Used by the /health page's migration helper modal so the user can see at a
 * glance which scripts still need pasting into the Supabase SQL editor.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createServerClient } from '@/lib/supabase/server'

interface MigrationInfo {
  file: string
  bytes: number
  /** Probable applied state. We greedily extract `ALTER TABLE x ADD COLUMN y`
   *  / `CREATE TABLE x (...)` and probe the live DB. When all probes succeed
   *  the migration is treated as applied. */
  applied: 'yes' | 'no' | 'unknown'
  /** Human-readable explanation. */
  reason: string
}

function extractColumnProbes(sql: string): { table: string; column: string }[] {
  const probes: { table: string; column: string }[] = []
  // ALTER TABLE foo ADD COLUMN [IF NOT EXISTS] bar TYPE …
  const alterRe = /ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)/gi
  for (const m of sql.matchAll(alterRe)) {
    probes.push({ table: m[1], column: m[2] })
  }
  return probes
}

function extractTableProbes(sql: string): string[] {
  const tables: string[] = []
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?(\w+)/gi
  for (const m of sql.matchAll(createRe)) {
    tables.push(m[1])
  }
  return tables
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dir = path.join(process.cwd(), 'supabase', 'migrations')

  let files: string[] = []
  try {
    files = (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.sql')).sort()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not list migrations', files: [] },
      { status: 500 }
    )
  }

  const supabase = createServerClient()
  const out: MigrationInfo[] = []
  for (const file of files) {
    const fullPath = path.join(dir, file)
    let sql = ''
    let bytes = 0
    try {
      sql = await fs.readFile(fullPath, 'utf8')
      bytes = sql.length
    } catch {
      out.push({ file, bytes: 0, applied: 'unknown', reason: 'Could not read file' })
      continue
    }

    const colProbes = extractColumnProbes(sql)
    const tableProbes = extractTableProbes(sql)
    if (colProbes.length === 0 && tableProbes.length === 0) {
      out.push({ file, bytes, applied: 'unknown', reason: 'No CREATE/ALTER statements detected' })
      continue
    }

    let allApplied = true
    const failures: string[] = []
    for (const probe of colProbes) {
      const { error } = await supabase.from(probe.table).select(probe.column).limit(1)
      if (error) {
        allApplied = false
        failures.push(`${probe.table}.${probe.column}`)
      }
    }
    for (const t of tableProbes) {
      const { error } = await supabase.from(t).select('*').limit(1)
      if (error) {
        allApplied = false
        failures.push(t)
      }
    }

    if (allApplied) {
      out.push({ file, bytes, applied: 'yes', reason: 'All probed objects present' })
    } else {
      out.push({
        file,
        bytes,
        applied: 'no',
        reason: `Missing: ${failures.slice(0, 5).join(', ')}${failures.length > 5 ? ` (+${failures.length - 5} more)` : ''}`,
      })
    }
  }

  return NextResponse.json({ migrations: out })
}
