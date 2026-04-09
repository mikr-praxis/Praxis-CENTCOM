import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/milestones?taskId=X — fetch milestones for a Monday task
// GET /api/milestones?taskIds=X,Y,Z — fetch milestones for multiple tasks
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const taskId = sp.get('taskId')
  const taskIds = sp.get('taskIds')

  const supabase = createServerClient()

  if (taskId) {
    const { data, error } = await supabase
      .from('task_milestones')
      .select('*')
      .eq('monday_task_id', taskId)
      .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ milestones: data || [] })
  }

  if (taskIds) {
    const ids = taskIds.split(',').filter(Boolean)
    const { data, error } = await supabase
      .from('task_milestones')
      .select('*')
      .in('monday_task_id', ids)
      .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group by monday_task_id
    const grouped: Record<string, typeof data> = {}
    for (const m of data || []) {
      if (!grouped[m.monday_task_id]) grouped[m.monday_task_id] = []
      grouped[m.monday_task_id].push(m)
    }
    return NextResponse.json({ milestones: grouped })
  }

  return NextResponse.json({ error: 'taskId or taskIds required' }, { status: 400 })
}

// POST /api/milestones — create or update milestones
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  const supabase = createServerClient()

  switch (action) {
    case 'create': {
      const { mondayTaskId, title, description, dueDate } = body
      if (!mondayTaskId || !title) {
        return NextResponse.json({ error: 'mondayTaskId and title required' }, { status: 400 })
      }

      // Get max sort_order for this task
      const { data: existing } = await supabase
        .from('task_milestones')
        .select('sort_order')
        .eq('monday_task_id', mondayTaskId)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

      const { data, error } = await supabase
        .from('task_milestones')
        .insert({
          monday_task_id: mondayTaskId,
          title,
          description: description || null,
          due_date: dueDate || null,
          sort_order: nextOrder,
          user_id: userId,
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ milestone: data })
    }

    case 'update': {
      const { id, title, description, status, dueDate, sortOrder } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title !== undefined) updates.title = title
      if (description !== undefined) updates.description = description
      if (status !== undefined) updates.status = status
      if (dueDate !== undefined) updates.due_date = dueDate
      if (sortOrder !== undefined) updates.sort_order = sortOrder

      const { data, error } = await supabase
        .from('task_milestones')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ milestone: data })
    }

    case 'delete': {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

      const { error } = await supabase
        .from('task_milestones')
        .delete()
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ deleted: true })
    }

    case 'reorder': {
      const { mondayTaskId, orderedIds } = body
      if (!mondayTaskId || !orderedIds?.length) {
        return NextResponse.json({ error: 'mondayTaskId and orderedIds required' }, { status: 400 })
      }

      // Update sort_order for each milestone
      const updates = orderedIds.map((id: string, index: number) =>
        supabase
          .from('task_milestones')
          .update({ sort_order: index, updated_at: new Date().toISOString() })
          .eq('id', id)
      )

      await Promise.all(updates)
      return NextResponse.json({ reordered: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
