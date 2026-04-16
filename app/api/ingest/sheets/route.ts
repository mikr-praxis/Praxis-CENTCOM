import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { extractSpreadsheetId, readAllTabs } from '@/lib/ingest/sheets-client'
import { runMetricMapper } from '@/lib/ingest/metric-mapper'
import type { FunnelType } from '@/lib/metrics/types'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { sheetUrl, clientSlug } = body as { sheetUrl: string; clientSlug: string }

  if (!sheetUrl || !clientSlug) {
    return NextResponse.json({ error: 'sheetUrl and clientSlug are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Look up client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', clientSlug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${clientSlug}` }, { status: 404 })
  }

  try {
    // Read sheet data
    const spreadsheetId = extractSpreadsheetId(sheetUrl)
    const sheetData = await readAllTabs(spreadsheetId)

    if (sheetData.length === 0) {
      return NextResponse.json({ error: 'No data found in the spreadsheet' }, { status: 400 })
    }

    // Run the AI mapper
    const mapperResult = await runMetricMapper(client.funnel_type as FunnelType, sheetData)

    // Create data source record
    const { data: dataSource, error: dsErr } = await supabase
      .from('data_sources')
      .insert({
        client_id: client.id,
        source_type: 'google_sheet',
        source_url: sheetUrl,
        column_mapping: mapperResult,
        mapping_status: 'pending',
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
