/**
 * Inspect a synced raw file: returns its columns, top distinct values per column
 * (with counts), a few sample rows, and inferred column types. Used by the
 * configurator to power column-aware filter value pickers and the file browser.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { getReportingTopValuesPerColumn } from '@/lib/reporting/config'

const SAMPLE_ROW_COUNT = 50

type ColumnType = 'number' | 'date' | 'boolean' | 'text'

function inferType(values: string[]): ColumnType {
  let nNum = 0
  let nDate = 0
  let nBool = 0
  let nNonEmpty = 0
  for (const v of values) {
    if (v === '' || v == null) continue
    nNonEmpty += 1
    const trimmed = v.trim().replace(/[$,]/g, '').replace(/%$/, '')
    if (/^(true|false|yes|no|y|n)$/i.test(trimmed)) nBool += 1
    if (!Number.isNaN(Number(trimmed))) nNum += 1
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(trimmed)) nDate += 1
  }
  if (nNonEmpty === 0) return 'text'
  if (nDate / nNonEmpty > 0.7) return 'date'
  if (nBool / nNonEmpty > 0.7) return 'boolean'
  if (nNum / nNonEmpty > 0.7) return 'number'
  return 'text'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { filename?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const filename = body.filename?.trim()
  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data: fileRow } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows, row_count')
    .eq('client_id', client.id)
    .eq('filename', filename)
    .maybeSingle()

  if (!fileRow) {
    return NextResponse.json({ error: `File not synced: ${filename}` }, { status: 404 })
  }

  const columns = Array.isArray(fileRow.columns) ? (fileRow.columns as string[]) : []
  const rows = Array.isArray(fileRow.rows) ? (fileRow.rows as Record<string, unknown>[]) : []
  const topValuesPerColumn = await getReportingTopValuesPerColumn()

  // Per-column: distinct value counts (top N) + inferred type
  const columnInfo = columns.map((col) => {
    const counts = new Map<string, number>()
    const stringValues: string[] = []
    for (const row of rows) {
      const raw = row[col]
      const v = raw == null ? '' : String(raw).trim()
      counts.set(v, (counts.get(v) ?? 0) + 1)
      stringValues.push(v)
    }
    const sorted = [...counts.entries()]
      .filter(([v]) => v !== '')
      .sort((a, b) => b[1] - a[1])
      .slice(0, topValuesPerColumn)
      .map(([value, count]) => ({ value, count }))
    return {
      name: col,
      type: inferType(stringValues),
      distinct_count: counts.size - (counts.has('') ? 1 : 0),
      empty_count: counts.get('') ?? 0,
      top_values: sorted,
    }
  })

  return NextResponse.json({
    filename: fileRow.filename,
    row_count: fileRow.row_count ?? rows.length,
    columns: columnInfo,
    sample_rows: rows.slice(0, SAMPLE_ROW_COUNT),
  })
}
