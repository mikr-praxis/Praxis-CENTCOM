import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI, evaluateKPISeries, pickGranularity, forecastSeries } from '@/lib/reporting/engine'
import { getReportingGranularityThresholds } from '@/lib/reporting/config'
import type { Formula, KPIDefinition, RawFileForEngine, Timeframe, Slicer } from '@/lib/reporting/types'
import type { ReportKPI, ReportRawFile, ChartOptions } from '@/lib/supabase/types'

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
    chart_options: (r.chart_options ?? {}) as ChartOptions,
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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const url = new URL(request.url)
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  const slicersRaw = url.searchParams.get('slicers')
  const timeframe: Timeframe = { start: start || null, end: end || null }
  let slicers: Slicer[] = []
  if (slicersRaw) {
    try {
      const parsed = JSON.parse(slicersRaw)
      if (Array.isArray(parsed)) {
        slicers = parsed.filter(
          (s): s is Slicer =>
            typeof s.filename === 'string' && typeof s.column === 'string' && Array.isArray(s.values)
        )
      }
    } catch {
      /* ignore bad slicers */
    }
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

  const { data: kpiRows } = await supabase
    .from('report_kpis')
    .select('*')
    .or(`client_id.eq.${client.id},client_id.is.null`)
    .order('display_order', { ascending: true })

  const { data: fileRows } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)

  const files = (fileRows ?? []).map(rowToFileForEngine)
  const definitions = (kpiRows ?? []).map(rowToDefinition)

  const granThresholds = await getReportingGranularityThresholds()
  const granularity = pickGranularity(timeframe, granThresholds)
  const results = definitions.map((d) => {
    const r = evaluateKPI(d, files, timeframe, { slicers })
    if (d.viz_type === 'line' || d.viz_type === 'bar' || d.viz_type === 'area') {
      r.series = evaluateKPISeries(d, files, timeframe, granularity, { slicers })
      if ((d.forecast_periods ?? 0) > 0 && r.series && r.series.length > 1) {
        r.forecast = forecastSeries(
          r.series,
          d.forecast_periods ?? 0,
          d.forecast_method ?? 'linear'
        )
      }
    }
    return r
  })

  return NextResponse.json({
    timeframe,
    granularity,
    slicers,
    kpi_count: definitions.length,
    file_count: files.length,
    results,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: Partial<ReportKPI> | { kpis: Partial<ReportKPI>[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
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

  // Bulk path: { kpis: [...] }
  if ('kpis' in body && Array.isArray(body.kpis)) {
    const seen = new Set<string>()
    type KPIInsert = Pick<ReportKPI, 'key' | 'display_name' | 'formula'> & Partial<ReportKPI>
    const inserts: KPIInsert[] = []
    let order = 0
    for (const k of body.kpis) {
      if (!k.key || !k.display_name || !k.formula) continue
      let key = k.key
      // Avoid in-batch duplicates
      let suffix = 1
      while (seen.has(key)) {
        key = `${k.key}_${suffix++}`
      }
      seen.add(key)
      inserts.push({
        client_id: client.id,
        key,
        display_name: k.display_name,
        description: k.description ?? null,
        formula: k.formula,
        format: k.format ?? 'count',
        target: k.target ?? null,
        viz_type: k.viz_type ?? 'card',
        display_order: k.display_order ?? order++,
        group_by_column: k.group_by_column ?? null,
        group_by_source: k.group_by_source ?? null,
        compare_to: k.compare_to ?? null,
        forecast_periods: k.forecast_periods ?? 0,
        forecast_method: k.forecast_method ?? null,
        chart_options: k.chart_options ?? {},
      })
    }
    if (inserts.length === 0) {
      return NextResponse.json({ error: 'No valid KPIs in request' }, { status: 400 })
    }
    const { data, error: insErr } = await supabase
      .from('report_kpis')
      .insert(inserts)
      .select()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, inserted: data?.length ?? 0, kpis: data })
  }

  // Single path
  const single = body as Partial<ReportKPI>
  if (!single.key || !single.display_name || !single.formula) {
    return NextResponse.json(
      { error: 'key, display_name, and formula are required' },
      { status: 400 }
    )
  }

  const insert = {
    client_id: client.id,
    key: single.key,
    display_name: single.display_name,
    description: single.description ?? null,
    formula: single.formula,
    format: single.format ?? 'count',
    target: single.target ?? null,
    viz_type: single.viz_type ?? 'card',
    display_order: single.display_order ?? 0,
    group_by_column: single.group_by_column ?? null,
    group_by_source: single.group_by_source ?? null,
    compare_to: single.compare_to ?? null,
    forecast_periods: single.forecast_periods ?? 0,
    forecast_method: single.forecast_method ?? null,
    chart_options: single.chart_options ?? {},
  }

  const { data, error: insertErr } = await supabase
    .from('report_kpis')
    .insert(insert)
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, kpi: data })
}
