import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

// ââ GET /api/projects/milestones?boardId=xxx âââââââââââââââââââââââââââââââââ

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const boardId = request.nextUrl.searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('board_milestones')
    .select('*')
    .eq('board_id', boardId)
    .order('milestone_number', { ascending: true })

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json({ milestones: [], needsMigration: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ milestones: data || [] })
}

// ââ POST /api/projects/milestones ââââââââââââââââââââââââââââââââââââââââââââ

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body
  const supabase = createServerClient()

  switch (action) {
    case 'create': {
      const { boardId, title, mondayTaskId, taskName, assigneeName, dueDate } = body
      if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

      // Get next milestone number
      const { data: existing } = await supabase
        .from('board_milestones')
        .select('milestone_number')
        .eq('board_id', boardId)
        .order('milestone_number', { ascending: false })
        .limit(1)

      const nextNum = (existing?.[0]?.milestone_number ?? 0) + 1

      const { data, error } = await supabase
        .from('board_milestones')
        .insert({
          board_id: boardId,
          milestone_number: nextNum,
          title: title || `Milestone ${nextNum}`,
          monday_task_id: mondayTaskId || null,
          task_name: taskName || null,
          assignee_name: assigneeName || null,
          due_date: dueDate || null,
          status: 'not_started' as const,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return NextResponse.json({ error: 'Table not found. Run migration 014_board_milestones.sql', needsMigration: true }, { status: 500 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ milestone: data })
    }

    case 'update': {
      const { id, title, mondayTaskId, taskName, assigneeName, dueDate, status, milestoneNumber } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title !== undefined) updates.title = title
      if (mondayTaskId !== undefined) updates.monday_task_id = mondayTaskId
      if (taskName !== undefined) updates.task_name = taskName
      if (assigneeName !== undefined) updates.assignee_name = assigneeName
      if (dueDate !== undefined) updates.due_date = dueDate || null
      if (status !== undefined) updates.status = status
      if (milestoneNumber !== undefined) updates.milestone_number = milestoneNumber

      const { data, error } = await supabase
        .from('board_milestones')
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
        .from('board_milestones')
        .delete()
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ deleted: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
