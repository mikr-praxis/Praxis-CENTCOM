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
        // Migration 016 columns: only include when explicitly set so DBs
        // that haven't run migration 016 yet still accept the insert.
        ...(k.group_by_column ? { group_by_column: k.group_by_column } : {}),
        ...(k.group_by_source ? { group_by_source: k.group_by_source } : {}),
        ...(k.compare_to ? { compare_to: k.compare_to } : {}),
        ...(k.forecast_periods && k.forecast_periods > 0
          ? { forecast_periods: k.forecast_periods }
          : {}),
        ...(k.forecast_method ? { forecast_method: k.forecast_method } : {}),
        // Migration 017 column: same pattern.
        ...(k.chart_options && Object.keys(k.chart_options).length > 0
          ? { chart_options: k.chart_options }
          : {}),
      })
    }
    if (inserts.length === 0) {
      return NextResponse.json({ error: 'No valid KPIs in request' }, { status: 400 })
    }
    // Defensive: PostgREST rejects the whole request if any field references
    // a column missing from the schema cache. We strip migration-016 and
    // migration-017 columns whenever they would carry default/empty values,
    // and keep them only when the caller explicitly populated them.
    const cleanInserts = inserts.map((row) => {
      const r = { ...row } as Record<string, unknown>
      if (r.group_by_column == null || r.group_by_column === '') delete r.group_by_column
      if (r.group_by_source == null || r.group_by_source === '') delete r.group_by_source
      if (r.compare_to == null || r.compare_to === '') delete r.compare_to
      if (r.forecast_periods == null || r.forecast_periods === 0) delete r.forecast_periods
      if (r.forecast_method == null || r.forecast_method === '') delete r.forecast_method
      if (
        r.chart_options == null ||
        (typeof r.chart_options === 'object' &&
          Object.keys(r.chart_options as object).length === 0)
      ) {
        delete r.chart_options
      }
      return r
    })
    // Bypass supabase-js: raw POST to PostgREST so no typed-client magic can
    // inject columns we don't explicitly send.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const rawRes = await fetch(`${supabaseUrl}/rest/v1/report_kpis`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(cleanInserts),
    })
    if (!rawRes.ok) {
      const errText = await rawRes.text()
      return NextResponse.json({ error: errText }, { status: 500 })
    }
    return NextResponse.json({ ok: true, inserted: cleanInserts.length })
  }

  // Single path
  const single = body as Partial<ReportKPI>
  if (!single.key || !single.display_name || !single.formula) {
    return NextResponse.json(
      { error: 'key, display_name, and formula are required' },
      { status: 400 }
    )
  }

  const insert: Record<string, unknown> = {
    client_id: client.id,
    key: single.key,
    display_name: single.display_name,
    description: single.description ?? null,
    formula: single.formula,
    format: single.format ?? 'count',
    target: single.target ?? null,
    viz_type: single.viz_type ?? 'card',
    display_order: single.display_order ?? 0,
    // Migration 016 columns: only include when explicitly set.
    ...(single.group_by_column ? { group_by_column: single.group_by_column } : {}),
    ...(single.group_by_source ? { group_by_source: single.group_by_source } : {}),
    ...(single.compare_to ? { compare_to: single.compare_to } : {}),
    ...(single.forecast_periods && single.forecast_periods > 0
      ? { forecast_periods: single.forecast_periods }
      : {}),
    ...(single.forecast_method ? { forecast_method: single.forecast_method } : {}),
    // Migration 017 column.
    ...(single.chart_options && Object.keys(single.chart_options).length > 0
      ? { chart_options: single.chart_options }
      : {}),
  }

  // Bypass supabase-js: raw POST so we never accidentally reference columns
  // that don't exist yet (migrations 016/017 may be pending).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  // Only request columns guaranteed by migration 015.
  const SAFE_COLS =
    'id,client_id,key,display_name,description,formula,format,target,viz_type,display_order,created_at,updated_at'
  const rawRes = await fetch(
    `${supabaseUrl}/rest/v1/report_kpis?select=${SAFE_COLS}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(insert),
    }
  )
  if (!rawRes.ok) {
    const errText = await rawRes.text()
    return NextResponse.json({ error: errText }, { status: 500 })
  }
  const rows = (await rawRes.json()) as unknown[]
  const data = Array.isArray(rows) ? rows[0] : rows

  return NextResponse.json({ ok: true, kpi: data })
}
