import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getAllTasks,
  getUsers,
  listBoards,
  getBoardItemsById,
  getBoardItemsPaginated,
  getItemUpdates,
  archiveItem,
  deleteItem,
  moveItemToGroup,
  batchArchiveItems,
  batchUpdateItems,
  clearMondayCache,
  setColumnMapping,
  getColumnMapping,
  type MondayError,
} from '@/lib/monday/client'
import { syncBoardToCache } from '@/app/api/monday/webhook/route'
import { hasConfig } from '@/lib/config'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/monday
// Actions: (default), boards, items, items-paginated, updates, column-mapping, cached-tasks, sync-status
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connected = await hasConfig('MONDAY_API_KEY')
  if (!connected) {
    return NextResponse.json({
      tasks: [], users: [], boards: [], items: [], connected: false,
    })
  }

  try {
    const sp = request.nextUrl.searchParams
    const action = sp.get('action')

    // action=boards
    if (action === 'boards') {
      const boards = await listBoards()
      return NextResponse.json({ boards, connected: true })
    }

    // action=items&boardId=X (legacy, no pagination)
    if (action === 'items' && sp.get('boardId')) {
      const items = await getBoardItemsById(
        sp.get('boardId')!,
        sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined
      )
      return NextResponse.json({ boardId: sp.get('boardId'), items, connected: true })
    }

    // action=items-paginated&boardId=X&limit=50&cursor=...
    if (action === 'items-paginated' && sp.get('boardId')) {
      const limit = sp.get('limit') ? parseInt(sp.get('limit')!, 10) : 50
      const cursor = sp.get('cursor') || undefined
      const result = await getBoardItemsPaginated(sp.get('boardId')!, limit, cursor)
      return NextResponse.json({ ...result, boardId: sp.get('boardId'), connected: true })
    }

    // action=updates&itemId=X
    if (action === 'updates' && sp.get('itemId')) {
      const updates = await getItemUpdates(
        sp.get('itemId')!,
        sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined
      )
      return NextResponse.json({ itemId: sp.get('itemId'), updates, connected: true })
    }

    // action=column-mapping — get current column mapping config
    if (action === 'column-mapping') {
      const mapping = getColumnMapping()
      // Also fetch from Supabase if board-specific
      const boardId = sp.get('boardId')
      if (boardId) {
        const supabase = createServerClient()
        const { data } = await supabase
          .from('monday_column_mappings')
          .select('*')
          .eq('board_id', boardId)
          .single()
        if (data) {
          return NextResponse.json({ mapping: data, defaults: mapping, connected: true })
        }
      }
      return NextResponse.json({ mapping, connected: true })
    }

    // action=cached-tasks — read from Supabase cache instead of live API
    if (action === 'cached-tasks') {
      const supabase = createServerClient()
      const { data: tasks, error } = await supabase
        .from('monday_tasks')
        .select('*')
        .eq('state', 'active')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(200)

      if (error) {
        console.error('Failed to read cached tasks:', error)
        // Fall back to live API
        const liveTasks = await getAllTasks()
        return NextResponse.json({ tasks: liveTasks, source: 'live', connected: true })
      }

      return NextResponse.json({ tasks: tasks || [], source: 'cache', connected: true })
    }

    // action=sync-status — check when cache was last synced
    if (action === 'sync-status') {
      const supabase = createServerClient()
      const { data } = await supabase
        .from('monday_tasks')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single()

      const { count } = await supabase
        .from('monday_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('state', 'active')

      return NextResponse.json({
        lastSync: data?.synced_at || null,
        cachedCount: count || 0,
        connected: true,
      })
    }

    // Default: return tasks and users (backward compatible)
    const boardIdsParam = sp.get('boardIds')
    const boardIds = boardIdsParam ? boardIdsParam.split(',') : undefined

    const [tasks, users] = await Promise.all([
      getAllTasks(boardIds),
      getUsers(),
    ])

    return NextResponse.json({ tasks, users, connected: true })
  } catch (err) {
    const mondayErr = err as MondayError
    console.error('Monday.com API error:', err)

    // Return specific error info for the UI
    return NextResponse.json({
      error: mondayErr.message || 'Failed to fetch Monday.com data',
      errorCode: mondayErr.code || 'UNKNOWN',
      retryAfter: mondayErr.retryAfter,
      tasks: [], users: [], boards: [], items: [], updates: [],
      connected: mondayErr.code !== 'NO_TOKEN',
    }, { status: mondayErr.status || 500 })
  }
}

// POST /api/monday
// Actions: archive, delete, move, batch-archive, batch-update, sync-board, save-column-mapping
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await hasConfig('MONDAY_API_KEY'))) {
    return NextResponse.json({ error: 'Monday.com not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'archive': {
        const { itemId } = body
        if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
        const result = await archiveItem(itemId)
        return NextResponse.json({ result, connected: true })
      }

      case 'delete': {
        const { itemId } = body
        if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
        const result = await deleteItem(itemId)
        return NextResponse.json({ result, connected: true })
      }

      case 'move': {
        const { itemId, groupId } = body
        if (!itemId || !groupId) return NextResponse.json({ error: 'itemId and groupId required' }, { status: 400 })
        const result = await moveItemToGroup(itemId, groupId)
        return NextResponse.json({ result, connected: true })
      }

      case 'batch-archive': {
        const { itemIds } = body
        if (!itemIds?.length) return NextResponse.json({ error: 'itemIds required' }, { status: 400 })
        const results = await batchArchiveItems(itemIds)
        return NextResponse.json({ results, archived: results.length, connected: true })
      }

      case 'batch-update': {
        const { updates } = body
        if (!updates?.length) return NextResponse.json({ error: 'updates required' }, { status: 400 })
        const results = await batchUpdateItems(updates)
        return NextResponse.json({ results, updated: results.length, connected: true })
      }

      case 'sync-board': {
        const { boardId } = body
        if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })
        const result = await syncBoardToCache(boardId)
        return NextResponse.json({ ...result, connected: true })
      }

      case 'sync-all': {
        const boards = await listBoards()
        let total = 0
        for (const board of boards) {
          const result = await syncBoardToCache(board.id)
          total += result.synced
        }
        return NextResponse.json({ synced: total, boards: boards.length, connected: true })
      }

      case 'clear-cache': {
        clearMondayCache()
        return NextResponse.json({ cleared: true, connected: true })
      }

      case 'save-column-mapping': {
        const { boardId, boardName, statusColumnId, dateColumnId, priorityColumnId, timelineColumnId, customMappings } = body
        if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

        const supabase = createServerClient()
        await supabase.from('monday_column_mappings').upsert({
          board_id: boardId,
          board_name: boardName || '',
          status_column_id: statusColumnId || null,
          date_column_id: dateColumnId || null,
          priority_column_id: priorityColumnId || null,
          timeline_column_id: timelineColumnId || null,
          custom_mappings: customMappings || {},
          updated_at: new Date().toISOString(),
        }, { onConflict: 'board_id' })

        return NextResponse.json({ saved: true, connected: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    const mondayErr = err as MondayError
    console.error('Monday.com POST error:', err)
    return NextResponse.json({
      error: mondayErr.message || 'Monday.com operation failed',
      errorCode: mondayErr.code || 'UNKNOWN',
      connected: true,
    }, { status: mondayErr.status || 500 })
  }
}
