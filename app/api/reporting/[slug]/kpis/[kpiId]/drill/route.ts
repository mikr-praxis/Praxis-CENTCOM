/**
 * Drill-down: returns the rows that contributed to a KPI's current value.
 * Reapplies the KPI's filters + the active timeframe + any active slicers.
 *
 * Only supports top-level AggOp formulas in v1 (composite formulas can be
 * dissected — but a KPI like "ratio of A to B" doesn't have one row set).
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import type { AggOp, Formula, Slicer } from '@/lib/reporting/types'

const PAGE_SIZE = 100

function parseLooseDate(s: string): number | null {
  if (!s) return null
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

function compareCell(cell: unknown, op: string, target: unknown): boolean {
  const cellStr = cell == null ? '' : String(cell).trim()
  const cellLower = cellStr.toLowerCase()
  const targetArr = Array.isArray(target) ? target : target == null ? [] : [target]
  const targetStrs = targetArr.map((v) => String(v).toLowerCase())
  const targetNum = targetArr.length > 0 ? Number(String(targetArr[0]).replace(/[$,\s%]/g, '')) : null
  const cellNum = Number(cellStr.replace(/[$,\s%]/g, ''))
  switch (op) {
    case 'eq':
      return cellLower === targetStrs[0]
    case 'neq':
      return cellLower !== targetStrs[0]
    case 'in':
      return targetStrs.includes(cellLower)
    case 'not_in':
      return !targetStrs.includes(cellLower)
    case 'contains':
      return cellLower.includes(targetStrs[0] ?? '')
    case 'gt':
      return Number.isFinite(cellNum) && targetNum != null && cellNum > targetNum
    case 'gte':
      return Number.isFinite(cellNum) && targetNum != null && cellNum >= targetNum
    case 'lt':
      return Number.isFinite(cellNum) && targetNum != null && cellNum < targetNum
    case 'lte':
      return Number.isFinite(cellNum) && targetNum != null && cellNum <= targetNum
    case 'not_empty':
      return cellStr !== ''
    case 'empty':
      return cellStr === ''
  }
  return false
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; kpiId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug, kpiId } = await params
  const url = new URL(request.url)
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  const slicersRaw = url.searchParams.get('slicers')
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))

  let slicers: Slicer[] = []
  if (slicersRaw) {
    try {
      const parsed = JSON.parse(slicersRaw)
      if (Array.isArray(parsed)) slicers = parsed
    } catch {
      /* ignore */
    }
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

  const { data: kpi } = await supabase
    .from('report_kpis')
    .select('id, formula, display_name')
    .eq('id', kpiId)
    .maybeSingle()
  if (!kpi) {
    return NextResponse.json({ error: 'KPI not found' }, { status: 404 })
  }

  const formula = kpi.formula as unknown as Formula
  // Only top-level Aggregation supports drill-down; composites/constants don't have a single row set.
  if (!('source' in formula) || !(formula as AggOp).source) {
    return NextResponse.json(
      {
        error:
          'Drill-down only supported for top-level Aggregation KPIs. This KPI uses a composite or constant formula.',
      },
      { status: 400 }
    )
  }
  const agg = formula as AggOp

  const { data: fileRow } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)
    .eq('filename', agg.source)
    .maybeSingle()
  if (!fileRow) {
    return NextResponse.json({ error: `Source file not synced: ${agg.source}` }, { status: 404 })
  }

  const columns = Array.isArray(fileRow.columns) ? (fileRow.columns as string[]) : []
  const rows = Array.isArray(fileRow.rows) ? (fileRow.rows as Record<string, unknown>[]) : []

  // Apply KPI's own filters
  let filtered = rows.filter((row) => {
    if (!agg.filters || agg.filters.length === 0) return true
    return agg.filters.every((f) => compareCell(row[f.column], f.op, f.value))
  })
  // Apply timeframe filter
  if (agg.timeframe_column && (start || end)) {
    const startTs = start ? parseLooseDate(start) : null
    const endTs = end ? parseLooseDate(end) : null
    filtered = filtered.filter((row) => {
      const v = row[agg.timeframe_column!]
      const ts = v != null && v !== '' ? parseLooseDate(String(v)) : null
      if (ts == null) return false
      if (startTs != null && ts < startTs) return false
      if (endTs != null) {
        // make end-of-day inclusive for date-only ends
        const endInclusive = end && end.length <= 10 ? endTs + 24 * 60 * 60 * 1000 - 1 : endTs
        if (ts > endInclusive) return false
      }
      return true
    })
  }
  // Apply slicers
  for (const s of slicers) {
    if (s.filename !== agg.source) continue
    if (!columns.includes(s.column)) continue
    if (!s.values || s.values.length === 0) continue
    const allowed = new Set(s.values.map((v) => v.toLowerCase()))
    filtered = filtered.filter((row) => {
      const v = row[s.column]
      const cs = v == null ? '' : String(v).trim().toLowerCase()
      return allowed.has(cs)
    })
  }

  const total = filtered.length
  const startIdx = (page - 1) * PAGE_SIZE
  const slice = filtered.slice(startIdx, startIdx + PAGE_SIZE)

  return NextResponse.json({
    kpi_id: kpiId,
    display_name: kpi.display_name,
    source: agg.source,
    columns,
    total_rows: total,
    page,
    page_size: PAGE_SIZE,
    rows: slice,
  })
}
