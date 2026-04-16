import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const url = new URL(request.url)
  const timeRange = url.searchParams.get('range') || '13w'
  const periodType = (url.searchParams.get('period') || 'week') as 'day' | 'week' | 'month'

  const supabase = createServerClient()

  // Look up client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Calculate date range
  const now = new Date()
  let startDate: Date
  switch (timeRange) {
    case '4w':
      startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
      break
    case '13w':
      startDate = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000)
      break
    default:
      startDate = new Date('2020-01-01')
  }

  const { data: snapshots, error: snapErr } = await supabase
    .from('metric_snapshots')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_type', periodType)
    .gte('period_date', startDate.toISOString().split('T')[0])
    .order('period_date', { ascending: true })

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 })
  }

  // Get events for this client
  const { data: events } = await supabase
    .from('client_events')
    .select('*')
    .eq('client_id', client.id)
    .order('event_date', { ascending: true })

  return NextResponse.json({
    client: {
      id: client.id,
      slug: client.slug,
      name: client.name,
      funnel_type: client.funnel_type,
      funnel_config: client.funnel_config,
    },
    snapshots: snapshots || [],
    events: events || [],
    timeRange,
    periodType,
  })
}

// POST: approve mapping and write metric snapshots
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const body = await request.json()
  const { dataSourceId, approvedMappings, sheetData } = body as {
    dataSourceId: string
    approvedMappings: Array<{
      raw_column: string
      tab: string
      canonical_metric: string
      confidence: string
    }>
    sheetData: Array<{
      name: string
      headers: string[]
      sampleRows: string[][]
      allRows?: string[][]
    }>
  }

  const supabase = createServerClient()

  // Get client
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Update data source with approved mapping
  await supabase
    .from('data_sources')
    .update({
      column_mapping: { approved: approvedMappings },
      mapping_status: 'approved',
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', dataSourceId)

  // Extract metric values from sheet data using approved mappings
  const snapshots: Array<{
    client_id: string
    metric_key: string
    metric_value: number
    period_date: string
    period_type: string
    confidence: string
    source_id: string
  }> = []

  for (const mapping of approvedMappings) {
    const tab = sheetData.find(t => t.name === mapping.tab)
    if (!tab || !tab.allRows) continue

    const colIndex = tab.headers.indexOf(mapping.raw_column)
    if (colIndex === -1) continue

    // Find date column (first column that looks like dates)
    const dateColIndex = tab.headers.findIndex(h =>
      /date|week|month|period/i.test(h)
    )

    for (const row of tab.allRows) {
      const rawValue = row[colIndex]
      const numericValue = parseNumericValue(rawValue)
      if (numericValue === null) continue

      const periodDate = dateColIndex >= 0 ? parseDateValue(row[dateColIndex]) : null
      if (!periodDate) continue

      snapshots.push({
        client_id: client.id,
        metric_key: mapping.canonical_metric,
        metric_value: numericValue,
        period_date: periodDate,
        period_type: 'week',
        confidence: mapping.confidence,
        source_id: dataSourceId,
      })
    }
  }

  if (snapshots.length > 0) {
    const { error: insertErr } = await supabase
      .from('metric_snapshots')
      .upsert(snapshots, { onConflict: 'client_id,metric_key,period_date,period_type' })

    if (insertErr) {
      return NextResponse.json({ error: `Failed to insert snapshots: ${insertErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({
    snapshotsCreated: snapshots.length,
    clientSlug: slug,
  })
}

function parseNumericValue(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null
  // Remove currency symbols, commas, percent signs
  const cleaned = raw.replace(/[$,\s%]/g, '')
  const num = Number(cleaned)
  return isNaN(num) ? null : num
}

function parseDateValue(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null
  // Try common date formats
  const d = new Date(raw.trim())
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  return null
}
