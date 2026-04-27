import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import type { ReportKPI } from '@/lib/supabase/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; kpiId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug, kpiId } = await params

  let body: Partial<ReportKPI>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Verify the KPI belongs to this client (or is a global one — we still allow edit if exec)
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Build update payload. Migration 016/017 columns are only included when
  // the caller actually populated a non-empty value, so DBs that haven't run
  // those migrations still accept the PATCH.
  const update: Record<string, unknown> = {
    ...(body.key !== undefined ? { key: body.key } : {}),
    ...(body.display_name !== undefined ? { display_name: body.display_name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.formula !== undefined ? { formula: body.formula } : {}),
    ...(body.format !== undefined ? { format: body.format } : {}),
    ...(body.target !== undefined ? { target: body.target } : {}),
    ...(body.viz_type !== undefined ? { viz_type: body.viz_type } : {}),
    ...(body.display_order !== undefined ? { display_order: body.display_order } : {}),
    ...(body.group_by_column ? { group_by_column: body.group_by_column } : {}),
    ...(body.group_by_source ? { group_by_source: body.group_by_source } : {}),
    ...(body.compare_to ? { compare_to: body.compare_to } : {}),
    ...(body.forecast_periods && body.forecast_periods > 0
      ? { forecast_periods: body.forecast_periods }
      : {}),
    ...(body.forecast_method ? { forecast_method: body.forecast_method } : {}),
    ...(body.chart_options && Object.keys(body.chart_options).length > 0
      ? { chart_options: body.chart_options }
      : {}),
    updated_at: new Date().toISOString(),
  }

  // Bypass supabase-js: raw PATCH so no typed-client magic injects columns
  // that may not exist yet on databases pending migrations 016/017.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  // Only ask for columns guaranteed by migration 015.
  const SAFE_COLS =
    'id,client_id,key,display_name,description,formula,format,target,viz_type,display_order,created_at,updated_at'
  const rawRes = await fetch(
    `${supabaseUrl}/rest/v1/report_kpis?id=eq.${encodeURIComponent(kpiId)}&client_id=eq.${encodeURIComponent(client.id)}&select=${SAFE_COLS}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(update),
    }
  )
  if (!rawRes.ok) {
    const errText = await rawRes.text()
    return NextResponse.json({ error: errText }, { status: 500 })
  }
  const rows = (await rawRes.json()) as unknown[]
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'KPI not found for this client' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, kpi: rows[0] })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; kpiId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug, kpiId } = await params

  const supabase = createServerClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { error } = await supabase
    .from('report_kpis')
    .delete()
    .eq('id', kpiId)
    .eq('client_id', client.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
