import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/ingest/csv-parser'
import { runMetricMapper } from '@/lib/ingest/metric-mapper'
import type { FunnelType } from '@/lib/metrics/types'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { csvData, clientSlug } = body as { csvData: string; clientSlug: string }

  if (!csvData || !clientSlug) {
    return NextResponse.json({ error: 'csvData and clientSlug are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', clientSlug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${clientSlug}` }, { status: 404 })
  }

  try {
    const sheetData = [parseCSV(csvData)]

    if (sheetData[0].headers.length === 0) {
      return NextResponse.json({ error: 'No valid data found in CSV' }, { status: 400 })
    }

    const mapperResult = await runMetricMapper(client.funnel_type as FunnelType, sheetData)

    const { data: dataSource, error: dsErr } = await supabase
      .from('data_sources')
      .insert({
        client_id: client.id,
        source_type: 'csv',
        column_mapping: mapperResult as unknown as Record<string, unknown>,
        mapping_status: 'pending' as const,
      })
      .select()
      .single()

    if (dsErr) {
      return NextResponse.json({ error: `Failed to create data source: ${dsErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      dataSourceId: dataSource.id,
      clientSlug: client.slug,
      clientName: client.name,
      funnelType: client.funnel_type,
      sheetData,
      mapping: mapperResult,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
