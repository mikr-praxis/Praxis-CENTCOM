import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI, evaluateKPISeries, pickGranularity } from '@/lib/reporting/engine'
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
  const timeframe: Timeframe = { start: start || null, end: end || null }

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

  const granularity = pickGranularity(timeframe)
  const results = definitions.map((d) => {
    const r = evaluateKPI(d, files, timeframe)
    if (d.viz_type === 'line' || d.viz_type === 'bar') {
      r.series = evaluateKPISeries(d, files, timeframe, granularity)
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: Partial<ReportKPI>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.key || !body.display_name || !body.formula) {
    return NextResponse.json(
      { error: 'key, display_name, and formula are required' },
      { status: 400 }
    )
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

  const insert = {
    client_id: client.id,
    key: body.key,
    display_name: body.display_name,
    description: body.description ?? null,
    formula: body.formula,
    format: body.format ?? 'count',
    target: body.target ?? null,
    viz_type: body.viz_type ?? 'card',
    display_order: body.display_order ?? 0,
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
