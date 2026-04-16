import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

// ââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type ProjectKPI = {
  id: string
  board_id: string
  kpi_name: string
  target_value: number | null
  current_value: number | null
  unit: string       // e.g. '$', '%', '#', 'days'
  sort_order: number
  created_at: string
  updated_at: string
}

export type KPISnapshot = {
  id: string
  kpi_id: string
  value: number
  recorded_at: string
}

// ââ GET /api/projects/kpis?boardId=xxx âââââââââââââââââââââââââââââââââââââ

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const boardId = request.nextUrl.searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

  const supabase = createServerClient()

  // Fetch KPIs for this board
  const { data: kpis, error: kpiError } = await supabase
    .from('project_kpis')
    .select('*')
    .eq('board_id', boardId)
    .order('sort_order', { ascending: true })

  if (kpiError) {
    // Gracefully handle missing table (migration not yet run)
    if (kpiError.code === '42P01' || kpiError.message?.includes('does not exist')) {
      return NextResponse.json({ kpis: [], snapshots: [], needsMigration: true })
    }
    console.error('KPI fetch error:', kpiError)
    return NextResponse.json({ error: kpiError.message }, { status: 500 })
  }

  // Fetch recent snapshots for each KPI (last 12 entries)
  const kpiIds = (kpis || []).map((k: ProjectKPI) => k.id)
  let snapshots: KPISnapshot[] = []

  if (kpiIds.length > 0) {
    const { data: snapshotData, error: snapError } = await supabase
      .from('kpi_snapshots')
      .select('*')
      .in('kpi_id', kpiIds)
      .order('recorded_at', { ascending: true })

    if (!snapError && snapshotData) {
      snapshots = snapshotData as KPISnapshot[]
    }
  }

  return NextResponse.json({ kpis: kpis || [], snapshots })
}

// ââ POST /api/projects/kpis ââââââââââââââââââââââââââââââââââââââââââââââââ

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  const supabase = createServerClient()

  // Create a new KPI
  if (action === 'create') {
    const { board_id, kpi_name, target_value, current_value, unit } = body

    // Get current max sort_order
    const { data: existing } = await supabase
      .from('project_kpis')
      .select('sort_order')
      .eq('board_id', board_id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

    const { data, error } = await supabase
      .from('project_kpis')
      .insert({
        board_id,
        kpi_name,
        target_value: target_value ?? null,
        current_value: current_value ?? null,
        unit: unit || '#',
        sort_order: nextOrder,
        user_id: userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Create initial snapshot if current_value provided
    if (current_value != null) {
      await supabase.from('kpi_snapshots').insert({
        kpi_id: data.id,
        value: current_value,
        recorded_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ kpi: data })
  }

  // Update a KPI value
  if (action === 'update') {
    const { id, kpi_name, target_value, current_value, unit } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (kpi_name !== undefined) updateData.kpi_name = kpi_name
    if (target_value !== undefined) updateData.target_value = target_value
    if (current_value !== undefined) updateData.current_value = current_value
    if (unit !== undefined) updateData.unit = unit

    const { data, error } = await supabase
      .from('project_kpis')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Record snapshot when value changes
    if (current_value !== undefined) {
      await supabase.from('kpi_snapshots').insert({
        kpi_id: id,
        value: current_value,
        recorded_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ kpi: data })
  }

  // Delete a KPI
  if (action === 'delete') {
    const { id } = body

    // Delete snapshots first
    await supabase.from('kpi_snapshots').delete().eq('kpi_id', id)
    const { error } = await supabase.from('project_kpis').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
