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

  const update: Partial<ReportKPI> = {
    ...(body.key !== undefined ? { key: body.key } : {}),
    ...(body.display_name !== undefined ? { display_name: body.display_name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.formula !== undefined ? { formula: body.formula } : {}),
    ...(body.format !== undefined ? { format: body.format } : {}),
    ...(body.target !== undefined ? { target: body.target } : {}),
    ...(body.viz_type !== undefined ? { viz_type: body.viz_type } : {}),
    ...(body.display_order !== undefined ? { display_order: body.display_order } : {}),
    ...(body.group_by_column !== undefined ? { group_by_column: body.group_by_column } : {}),
    ...(body.group_by_source !== undefined ? { group_by_source: body.group_by_source } : {}),
    ...(body.compare_to !== undefined ? { compare_to: body.compare_to } : {}),
    ...(body.forecast_periods !== undefined ? { forecast_periods: body.forecast_periods } : {}),
    ...(body.forecast_method !== undefined ? { forecast_method: body.forecast_method } : {}),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('report_kpis')
    .update(update)
    .eq('id', kpiId)
    .eq('client_id', client.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'KPI not found for this client' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, kpi: data })
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
