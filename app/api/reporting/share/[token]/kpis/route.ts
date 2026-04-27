/**
 * Public (no Clerk) KPI computation endpoint, for client-facing share-token URLs.
 * Validates the token against report_share_tokens, then returns the same KPI
 * results shape as the authenticated /api/reporting/[slug]/kpis endpoint.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI, evaluateKPISeries, pickGranularity, forecastSeries } from '@/lib/reporting/engine'
import { getReportingGranularityThresholds } from '@/lib/reporting/config'
import type { Formula, KPIDefinition, RawFileForEngine, Timeframe } from '@/lib/reporting/types'
import type { ReportKPI, ReportRawFile } from '@/lib/supabase/types'

function rowToDefinition(r: ReportKPI): KPIDefinition {
  return {
    id: r.id,
    client_id: r.client_id,
    key: r.key,
    display_name: r.display_name,
    description: r.description,
    formula: r.formula as unknown as Formula,
    format: r.format,
    target: r.target,
    viz_type: r.viz_type,
    display_order: r.display_order,
    group_by_column: r.group_by_column ?? null,
    group_by_source: r.group_by_source ?? null,
    compare_to: r.compare_to ?? null,
    forecast_periods: r.forecast_periods ?? 0,
    forecast_method: r.forecast_method ?? null,
    chart_options: r.chart_options ?? {},
  }
}

function rowToFileForEngine(r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>): RawFileForEngine {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    rows: Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [],
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const url = new URL(request.url)
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  const timeframe: Timeframe = { start: start || null, end: end || null }

  const supabase = createServerClient()
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('report_share_tokens')
    .select('client_id, expires_at, revoked_at')
    .eq('token', token)
    .single()
  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }
  if (tokenRow.revoked_at) {
    return NextResponse.json({ error: 'Token revoked' }, { status: 403 })
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 403 })
  }

  const { data: kpiRows } = await supabase
    .from('report_kpis')
    .select('*')
    .or(`client_id.eq.${tokenRow.client_id},client_id.is.null`)
    .order('display_order', { ascending: true })

  const { data: fileRows } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', tokenRow.client_id)

  const files = (fileRows ?? []).map(rowToFileForEngine)
  const definitions = (kpiRows ?? []).map(rowToDefinition)

  const granThresholds = await getReportingGranularityThresholds()
  const granularity = pickGranularity(timeframe, granThresholds)
  const results = definitions.map((d) => {
    const r = evaluateKPI(d, files, timeframe)
    if (d.viz_type === 'line' || d.viz_type === 'bar' || d.viz_type === 'area') {
      r.series = evaluateKPISeries(d, files, timeframe, granularity)
      if ((d.forecast_periods ?? 0) > 0 && r.series && r.series.length > 1) {
        r.forecast = forecastSeries(r.series, d.forecast_periods ?? 0, d.forecast_method ?? 'linear')
      }
    }
    return r
  })

  return NextResponse.json({
    timeframe,
    granularity,
    kpi_count: definitions.length,
    file_count: files.length,
    results,
  })
}
