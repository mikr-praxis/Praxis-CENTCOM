/**
 * Returns the date range present in synced raw data, per-file and globally.
 * Used by the TimeframePicker to anchor "data-relative" presets and warn when
 * a calendar preset would fall outside the data window.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { getReportingDateParseThreshold } from '@/lib/reporting/config'

const DATE_COL_PATTERNS = [
  /\b(date|time|created|modified|updated|when|ts|timestamp)\b/i,
  /_at$/i,
  /_on$/i,
  /_date$/i,
  /_time$/i,
]

function looksLikeDateColumn(name: string): boolean {
  return DATE_COL_PATTERNS.some((p) => p.test(name))
}

function parseLooseDate(s: string): number | null {
  if (!s) return null
  // Bare YYYY-MM-DD → local midnight (consistent with the engine + picker)
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

interface ColumnRange {
  column: string
  min: string
  max: string
  parsed_count: number
  total_count: number
}

interface FileRange {
  filename: string
  row_count: number
  date_columns: ColumnRange[]
  /** Best-guess primary date column (highest parsed ratio). */
  primary_column: string | null
  primary_min: string | null
  primary_max: string | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  const supabase = createServerClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data: rawFiles } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows, row_count')
    .eq('client_id', client.id)

  const fileRanges: FileRange[] = []
  let globalMinTs: number | null = null
  let globalMaxTs: number | null = null
  const dateThreshold = await getReportingDateParseThreshold()

  for (const f of rawFiles ?? []) {
    const columns = Array.isArray(f.columns) ? (f.columns as string[]) : []
    const rows = Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []

    // Candidate columns: anything by name OR scan top values
    const candidates = columns.filter((c) => looksLikeDateColumn(c))
    // If no name-matched candidates, scan all columns for any with parseable dates
    const scanCols = candidates.length > 0 ? candidates : columns

    const ranges: ColumnRange[] = []
    let bestCol: string | null = null
    let bestRatio = 0
    let bestMinTs: number | null = null
    let bestMaxTs: number | null = null

    for (const col of scanCols) {
      let minTs: number | null = null
      let maxTs: number | null = null
      let parsed = 0
      for (const row of rows) {
        const v = row[col]
        if (v == null || v === '') continue
        const ts = parseLooseDate(String(v))
        if (ts == null) continue
        parsed += 1
        if (minTs == null || ts < minTs) minTs = ts
        if (maxTs == null || ts > maxTs) maxTs = ts
      }
      const ratio = rows.length > 0 ? parsed / rows.length : 0
      if (parsed > 0 && minTs != null && maxTs != null && ratio > dateThreshold) {
        ranges.push({
          column: col,
          min: new Date(minTs).toISOString(),
          max: new Date(maxTs).toISOString(),
          parsed_count: parsed,
          total_count: rows.length,
        })
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestCol = col
          bestMinTs = minTs
          bestMaxTs = maxTs
        }
      }
    }

    if (bestMinTs != null && (globalMinTs == null || bestMinTs < globalMinTs)) globalMinTs = bestMinTs
    if (bestMaxTs != null && (globalMaxTs == null || bestMaxTs > globalMaxTs)) globalMaxTs = bestMaxTs

    fileRanges.push({
      filename: f.filename,
      row_count: f.row_count ?? rows.length,
      date_columns: ranges,
      primary_column: bestCol,
      primary_min: bestMinTs != null ? new Date(bestMinTs).toISOString() : null,
      primary_max: bestMaxTs != null ? new Date(bestMaxTs).toISOString() : null,
    })
  }

  return NextResponse.json({
    files: fileRanges,
    global_min: globalMinTs != null ? new Date(globalMinTs).toISOString() : null,
    global_max: globalMaxTs != null ? new Date(globalMaxTs).toISOString() : null,
    span_days:
      globalMinTs != null && globalMaxTs != null
        ? Math.round((globalMaxTs - globalMinTs) / (24 * 60 * 60 * 1000))
        : null,
  })
}
