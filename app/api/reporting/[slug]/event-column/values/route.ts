/**
 * For a given (filename, column), return distinct values in that column and the
 * date range each value spans. The TimeframePicker uses this to populate an
 * "event" dropdown driven directly by raw data — pick a value, get its date
 * range as the timeframe.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

const DATE_COL_PATTERNS = [
  /\b(date|time|created|modified|updated|when|ts|timestamp)\b/i,
  /_at$/i,
  /_on$/i,
  /_date$/i,
  /_time$/i,
]

const MAX_VALUES = 100

function looksLikeDateColumn(name: string): boolean {
  return DATE_COL_PATTERNS.some((p) => p.test(name))
}

function parseLooseDate(s: string): number | null {
  if (!s) return null
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const dt = new Date(
      parseInt(dateOnly[1], 10),
      parseInt(dateOnly[2], 10) - 1,
      parseInt(dateOnly[3], 10)
    )
    if (!Number.isNaN(dt.getTime())) return dt.getTime()
  }
  const t = new Date(s).getTime()
  if (!Number.isNaN(t)) return t
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let yr = parseInt(m[3], 10)
    if (yr < 100) yr += 2000
    const dt = new Date(yr, parseInt(m[1], 10) - 1, parseInt(m[2], 10))
    if (!Number.isNaN(dt.getTime())) return dt.getTime()
  }
  return null
}

function pickPrimaryDateColumn(columns: string[], rows: Record<string, unknown>[]): string | null {
  const candidates = columns.filter((c) => looksLikeDateColumn(c))
  const scanCols = candidates.length > 0 ? candidates : columns
  let best: string | null = null
  let bestRatio = 0
  for (const col of scanCols) {
    let parsed = 0
    for (const row of rows) {
      const v = row[col]
      if (v == null || v === '') continue
      if (parseLooseDate(String(v)) != null) parsed += 1
    }
    const ratio = rows.length > 0 ? parsed / rows.length : 0
    if (ratio > 0.3 && ratio > bestRatio) {
      best = col
      bestRatio = ratio
    }
  }
  return best
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { filename?: string; column?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.filename || !body.column) {
    return NextResponse.json({ error: 'filename and column are required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data: fileRow } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)
    .eq('filename', body.filename)
    .maybeSingle()
  if (!fileRow) {
    return NextResponse.json({ error: `File not synced: ${body.filename}` }, { status: 404 })
  }

  const columns = Array.isArray(fileRow.columns) ? (fileRow.columns as string[]) : []
  const rows = Array.isArray(fileRow.rows) ? (fileRow.rows as Record<string, unknown>[]) : []

  if (!columns.includes(body.column)) {
    return NextResponse.json({ error: `Column not found: ${body.column}` }, { status: 400 })
  }

  const dateCol = pickPrimaryDateColumn(columns, rows)

  // Group rows by the chosen column's value
  const groups = new Map<string, { count: number; minTs: number | null; maxTs: number | null }>()
  for (const row of rows) {
    const raw = row[body.column]
    const v = raw == null ? '' : String(raw).trim()
    if (v === '') continue
    let g = groups.get(v)
    if (!g) {
      g = { count: 0, minTs: null, maxTs: null }
      groups.set(v, g)
    }
    g.count += 1
    if (dateCol) {
      const ts = parseLooseDate(String(row[dateCol] ?? ''))
      if (ts != null) {
        if (g.minTs == null || ts < g.minTs) g.minTs = ts
        if (g.maxTs == null || ts > g.maxTs) g.maxTs = ts
      }
    }
  }

  const values = [...groups.entries()]
    .map(([value, g]) => ({
      value,
      count: g.count,
      min_date: g.minTs != null ? new Date(g.minTs).toISOString() : null,
      max_date: g.maxTs != null ? new Date(g.maxTs).toISOString() : null,
    }))
    .sort((a, b) => {
      // Most recent first when we have dates, otherwise by count desc
      if (a.max_date && b.max_date) return new Date(b.max_date).getTime() - new Date(a.max_date).getTime()
      return b.count - a.count
    })
    .slice(0, MAX_VALUES)

  return NextResponse.json({
    filename: body.filename,
    column: body.column,
    date_column: dateCol,
    distinct_count: groups.size,
    values,
  })
}
