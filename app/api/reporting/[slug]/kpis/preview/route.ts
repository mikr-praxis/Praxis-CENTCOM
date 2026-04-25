/**
 * Live preview a KPI formula without saving. Used by the configurator to show
 * the computed value as the user edits.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI, evaluateKPISeries, pickGranularity } from '@/lib/reporting/engine'
import { getReportingGranularityThresholds } from '@/lib/reporting/config'
import type { Formula, KPIDefinition, RawFileForEngine, Timeframe } from '@/lib/reporting/types'
import type { KPIFormat, KPIVizType, ReportRawFile } from '@/lib/supabase/types'

interface PreviewBody {
  formula: Formula
  format?: KPIFormat
  viz_type?: KPIVizType
  timeframe?: Timeframe
}

function rowToFileForEngine(r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>): RawFileForEngine {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    rows: Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [],
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: PreviewBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.formula) {
    return NextResponse.json({ error: 'formula is required' }, { status: 400 })
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

  const { data: fileRows } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)

  const files = (fileRows ?? []).map(rowToFileForEngine)
  const timeframe: Timeframe = body.timeframe ?? { start: null, end: null }

  const fakeKpi: KPIDefinition = {
    id: 'preview',
    client_id: client.id,
    key: 'preview',
    display_name: 'Preview',
    description: null,
    formula: body.formula,
    format: body.format ?? 'count',
    target: null,
    viz_type: body.viz_type ?? 'card',
    display_order: 0,
    group_by_column: null,
    group_by_source: null,
    compare_to: null,
    forecast_periods: 0,
    forecast_method: null,
  }

  const result = evaluateKPI(fakeKpi, files, timeframe)
  if (fakeKpi.viz_type === 'line' || fakeKpi.viz_type === 'bar') {
    const granThresholds = await getReportingGranularityThresholds()
    result.series = evaluateKPISeries(fakeKpi, files, timeframe, pickGranularity(timeframe, granThresholds))
  }
  return NextResponse.json({ result })
}
