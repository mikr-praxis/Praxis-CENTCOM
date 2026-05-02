/**
 * Zero-config standard lifetime tiles. Auto-detects revenue / calls-booked /
 * closes / leads / shows columns across the client's synced Drive files,
 * computes lifetime values via the engine, and returns them.
 *
 * If the user has explicitly configured a `std_lifetime_*` KPI (via the
 * catalog modal), that override wins — we evaluate the saved formula
 * instead of auto-detecting.
 *
 * Auto-detection is column-name heuristic — see lib/reporting/auto-detect.ts.
 * Conversion-rate variant defaults to book→close (closes / calls_booked)
 * because that's the most common funnel definition; users can override by
 * configuring the std_lifetime_conversion_rate tile manually.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI } from '@/lib/reporting/engine'
import { autoDetectColumns } from '@/lib/reporting/auto-detect'
import type {
  AggOp,
  Formula,
  KPIDefinition,
  RawFileForEngine,
  Timeframe,
} from '@/lib/reporting/types'
import type { ChartOptions, KPIFormat, KPIVizType, ReportKPI, ReportRawFile } from '@/lib/supabase/types'

interface TileResult {
  /** Catalog key — std_lifetime_revenue / std_lifetime_calls_booked / std_lifetime_conversion_rate. */
  key: string
  display_name: string
  format: KPIFormat
  value: number | null
  /** Whether this came from auto-detection or a user-saved override. */
  source: 'auto' | 'override'
  /** When auto, the column we picked (helpful for the UI's tooltip). */
  detected_column?: string | null
  /** Formula details for transparency. */
  rows_used?: number
  source_files?: string[]
  error: string | null
}

const STD_REVENUE = 'std_lifetime_revenue'
const STD_CALLS_BOOKED = 'std_lifetime_calls_booked'
const STD_CONVERSION_RATE = 'std_lifetime_conversion_rate'

function makeAllFilesAgg(column: string, op: AggOp['op'] = 'sum'): AggOp {
  return { op, source: '*', column, all_files: true }
}

function rowToFileForEngine(r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>): RawFileForEngine {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    rows: Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [],
  }
}

function rowToDefinition(r: ReportKPI): KPIDefinition {
  return {
    id: r.id,
    client_id: r.client_id,
    key: r.key,
    display_name: r.display_name,
    description: r.description,
    formula: r.formula as unknown as Formula,
    format: r.format as KPIFormat,
    target: r.target,
    viz_type: r.viz_type as KPIVizType,
    display_order: r.display_order,
    group_by_column: r.group_by_column ?? null,
    group_by_source: r.group_by_source ?? null,
    compare_to: r.compare_to ?? null,
    forecast_periods: r.forecast_periods ?? 0,
    forecast_method: r.forecast_method ?? null,
    chart_options: (r.chart_options ?? {}) as ChartOptions,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = createServerClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const [{ data: kpiRows }, { data: fileRows }] = await Promise.all([
    supabase
      .from('report_kpis')
      .select('*')
      .eq('client_id', client.id)
      .in('key', [STD_REVENUE, STD_CALLS_BOOKED, STD_CONVERSION_RATE]),
    supabase
      .from('report_raw_files')
      .select('filename, columns, rows')
      .eq('client_id', client.id),
  ])

  const files = (fileRows ?? []).map(rowToFileForEngine)
  const overridesByKey = new Map<string, KPIDefinition>(
    (kpiRows ?? []).map((r) => [r.key, rowToDefinition(r)])
  )
  const detected = autoDetectColumns(
    files.map((f) => ({ filename: f.filename, columns: f.columns }))
  )
  const lifetimeTimeframe: Timeframe = { start: null, end: null }

  function evalFormula(formula: Formula): { value: number | null; rows: number; sources: string[] } {
    const fakeKpi: KPIDefinition = {
      id: 'tmp',
      client_id: client!.id,
      key: 'tmp',
      display_name: '',
      description: null,
      formula,
      format: 'count',
      target: null,
      viz_type: 'card',
      display_order: 0,
    }
    const result = evaluateKPI(fakeKpi, files, lifetimeTimeframe)
    return { value: result.value, rows: result.rows_used, sources: result.source_files }
  }

  function buildTile(
    key: string,
    display_name: string,
    format: KPIFormat,
    autoColumn: string | null,
    autoFormulaFromColumn: (col: string) => Formula
  ): TileResult {
    const override = overridesByKey.get(key)
    if (override) {
      const r = evaluateKPI(override, files, lifetimeTimeframe)
      return {
        key,
        display_name,
        format,
        value: r.value,
        source: 'override',
        rows_used: r.rows_used,
        source_files: r.source_files,
        error: r.error,
      }
    }
    if (!autoColumn) {
      return {
        key,
        display_name,
        format,
        value: null,
        source: 'auto',
        detected_column: null,
        error: 'No matching column found across synced files.',
      }
    }
    const result = evalFormula(autoFormulaFromColumn(autoColumn))
    return {
      key,
      display_name,
      format,
      value: result.value,
      source: 'auto',
      detected_column: autoColumn,
      rows_used: result.rows,
      source_files: result.sources,
      error: null,
    }
  }

  const revenue: TileResult = buildTile(
    STD_REVENUE,
    'Total Lifetime Revenue',
    'currency',
    detected.revenue_column,
    (col) => makeAllFilesAgg(col, 'sum')
  )
  const callsBooked: TileResult = buildTile(
    STD_CALLS_BOOKED,
    'Total Calls Booked',
    'count',
    detected.calls_booked_column,
    (col) => makeAllFilesAgg(col, 'sum')
  )

  // Conversion rate: default to book→close (closes / calls_booked). Render
  // null with a clear error if either side is missing and there's no override.
  let conversionTile: TileResult
  const conversionOverride = overridesByKey.get(STD_CONVERSION_RATE)
  if (conversionOverride) {
    const r = evaluateKPI(conversionOverride, files, lifetimeTimeframe)
    conversionTile = {
      key: STD_CONVERSION_RATE,
      display_name: 'Total Conversion Rate',
      format: 'percent',
      value: r.value,
      source: 'override',
      rows_used: r.rows_used,
      source_files: r.source_files,
      error: r.error,
    }
  } else if (detected.closes_column && detected.calls_booked_column) {
    const formula: Formula = {
      op: 'divide',
      numerator: makeAllFilesAgg(detected.closes_column, 'sum'),
      denominator: makeAllFilesAgg(detected.calls_booked_column, 'sum'),
    }
    const r = evalFormula(formula)
    conversionTile = {
      key: STD_CONVERSION_RATE,
      display_name: 'Total Conversion Rate',
      format: 'percent',
      value: r.value,
      source: 'auto',
      detected_column: `${detected.closes_column} ÷ ${detected.calls_booked_column}`,
      rows_used: r.rows,
      source_files: r.sources,
      error: null,
    }
  } else {
    const missing: string[] = []
    if (!detected.closes_column) missing.push('closes')
    if (!detected.calls_booked_column) missing.push('calls booked')
    conversionTile = {
      key: STD_CONVERSION_RATE,
      display_name: 'Total Conversion Rate',
      format: 'percent',
      value: null,
      source: 'auto',
      detected_column: null,
      error: `Missing ${missing.join(' + ')} column${missing.length > 1 ? 's' : ''} across synced files.`,
    }
  }

  return NextResponse.json({
    file_count: files.length,
    detected,
    tiles: [revenue, callsBooked, conversionTile],
  })
}
