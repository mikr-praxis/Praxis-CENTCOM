/**
 * Free heuristic KPI suggester — no AI calls, no token usage. Mirrors the
 * shape of /kpis/ai-recommend so the UI can swap between them.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { heuristicSuggest, type FileHints, type ColumnHint } from '@/lib/reporting/heuristic-suggest'
import { getReportingTopValuesPerColumn } from '@/lib/reporting/config'

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

function buildColumnHint(name: string, rows: Record<string, unknown>[], topN: number): ColumnHint {
  const counts = new Map<string, number>()
  const stringVals: string[] = []
  for (const row of rows) {
    const raw = row[name]
    const v = raw == null ? '' : String(raw).trim()
    counts.set(v, (counts.get(v) ?? 0) + 1)
    stringVals.push(v)
  }
  const top = [...counts.entries()]
    .filter(([v]) => v !== '')
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([value, count]) => ({ value, count }))
  return {
    name,
    type: inferType(stringVals),
    distinct_count: counts.size - (counts.has('') ? 1 : 0),
    empty_count: counts.get('') ?? 0,
    top_values: top,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { filenames?: string[]; count?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body OK */
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

  let q = supabase
    .from('report_raw_files')
    .select('filename, columns, rows, row_count')
    .eq('client_id', client.id)
  if (body.filenames && body.filenames.length > 0) {
    q = q.in('filename', body.filenames)
  }
  const { data: rawFiles } = await q

  if (!rawFiles || rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'No synced files yet. Sync the Drive folder first.' },
      { status: 400 }
    )
  }

  const topN = await getReportingTopValuesPerColumn()
  const files: FileHints[] = rawFiles.map((f) => {
    const columns = Array.isArray(f.columns) ? (f.columns as string[]) : []
    const rows = Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []
    return {
      filename: f.filename,
      row_count: f.row_count ?? rows.length,
      columns: columns.map((c) => buildColumnHint(c, rows, topN)),
    }
  })

  const suggestions = heuristicSuggest({ files, count: body.count })
  return NextResponse.json({ ok: true, suggestions, source: 'heuristic' })
}
