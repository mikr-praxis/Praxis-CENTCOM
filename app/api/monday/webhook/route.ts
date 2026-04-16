import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getBoardItemsById, itemToTask } from '@/lib/monday/client'
import { hasConfig } from '@/lib/config'

// POST /api/monday/webhook
// Receives webhook events from Monday.com
// Monday sends a challenge on initial setup, then real events after.

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Monday.com webhook verification challenge
  // When you create a webhook, Monday sends { "challenge": "..." }
  // You must echo it back to verify the endpoint.
  if (body.challenge) {
    return NextResponse.json({ challenge: body.challenge })
  }

  // Verify Monday API is configured
  if (!(await hasConfig('MONDAY_API_KEY'))) {
    return NextResponse.json({ error: 'Monday not configured' }, { status: 503 })
  }

  const supabase = createServerClient()

  // Log the webhook event
  const event = body.event
  if (event) {
    await supabase.from('monday_webhook_log').insert({
      event_type: event.type || 'unknown',
      item_id: event.pulseId?.toString() || event.itemId?.toString() || null,
      board_id: event.boardId?.toString() || null,
      payload: body,
    })
  }

  try {
    const eventType = event?.type

    // Handle different event types
    switch (eventType) {
      case 'update_column_value':
      case 'change_column_value':
      case 'create_pulse':
      case 'create_item': {
        // Item created or updated — sync it
        const boardId = event.boardId?.toString()
        const itemId = event.pulseId?.toString() || event.itemId?.toString()

        if (boardId && itemId) {
          await syncItemToCache(supabase, boardId, itemId)
        }
        break
      }

      case 'delete_pulse':
      case 'delete_item': {
        // Item deleted — mark as deleted in cache
        const itemId = event.pulseId?.toString() || event.itemId?.toString()
        if (itemId) {
          await supabase
            .from('monday_tasks')
            .update({ state: 'deleted', updated_at: new Date().toISOString() })
            .eq('id', itemId)
        }
        break
      }

      case 'archive_pulse':
      case 'archive_item': {
        // Item archived
        const itemId = event.pulseId?.toString() || event.itemId?.toString()
        if (itemId) {
          await supabase
            .from('monday_tasks')
            .update({ state: 'archived', updated_at: new Date().toISOString() })
            .eq('id', itemId)
        }
        break
      }

      case 'move_pulse':
      case 'move_item': {
        // Item moved to different group — re-sync
        const boardId = event.boardId?.toString()
        const itemId = event.pulseId?.toString() || event.itemId?.toString()
        if (boardId && itemId) {
          await syncItemToCache(supabase, boardId, itemId)
        }
        break
      }

      default:
        // Log unknown events but don't fail
        console.log(`Unhandled Monday webhook event: ${eventType}`)
    }

    // Mark webhook as processed
    if (event) {
      await supabase
        .from('monday_webhook_log')
        .update({ processed: true })
        .eq('item_id', event.pulseId?.toString() || event.itemId?.toString())
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Monday webhook processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

// Fetch a single item from Monday and upsert it into the cache
async function syncItemToCache(
  supabase: ReturnType<typeof createServerClient>,
  boardId: string,
  itemId: string
) {
  try {
    const items = await getBoardItemsById(boardId, 200)
    const item = items.find((i) => i.id === itemId)

    if (!item) return

    const task = itemToTask(item)
    const now = new Date().toISOString()

    await supabase.from('monday_tasks').upsert({
      id: task.id,
      name: task.name,
      board_id: task.boardId,
      board_name: task.boardName,
      group_id: task.groupId,
      group_name: task.groupName,
      status: task.status,
      priority: task.priority,
      due_date: task.dueDate,
      timeline_start: task.timelineStart,
      timeline_end: task.timelineEnd,
      assignees: task.assignees,
      column_values: item.column_values,
      state: item.state,
      synced_at: now,
      updated_at: now,
    }, { onConflict: 'id' })
  } catch (err) {
    console.error(`Failed to sync item ${itemId} to cache:`, err)
  }
}

// Full board sync — call manually or on schedule
export async function syncBoardToCache(boardId: string) {
  const supabase = createServerClient()
  const items = await getBoardItemsById(boardId, 200)
  const now = new Date().toISOString()

  const rows = items.map((item) => {
    const task = itemToTask(item)
    return {
      id: task.id,
      name: task.name,
      board_id: task.boardId,
      board_name: task.boardName,
      group_id: task.groupId,
      group_name: task.groupName,
      status: task.status,
      priority: task.priority,
      due_date: task.dueDate,
      timeline_start: task.timelineStart,
      timeline_end: task.timelineEnd,
      assignees: task.assignees,
      column_values: item.column_values,
      state: item.state,
      synced_at: now,
      updated_at: now,
    }
  })

  if (rows.length > 0) {
    await supabase.from('monday_tasks').upsert(rows, { onConflict: 'id' })
  }

  return { synced: rows.length }
}
