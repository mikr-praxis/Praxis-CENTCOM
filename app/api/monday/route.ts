import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllTasks, getUsers, listBoards, getBoardItemsById, getItemUpdates } from '@/lib/monday/client'
import { hasConfig } from '@/lib/config'

// GET /api/monday?boardIds=123,456  (optional — fetches all boards if omitted)
// GET /api/monday?action=boards
// GET /api/monday?action=items&boardId=X
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Monday.com is configured
  if (!(await hasConfig('MONDAY_API_KEY'))) {
    return NextResponse.json({
      tasks: [],
      users: [],
      boards: [],
      items: [],
      connected: false,
    })
  }

  try {
    const action = request.nextUrl.searchParams.get('action')
    const boardId = request.nextUrl.searchParams.get('boardId')
    const itemId = request.nextUrl.searchParams.get('itemId')
    const limit = request.nextUrl.searchParams.get('limit')
    const queryLimit = limit ? parseInt(limit, 10) : undefined

    // action=boards — list all boards with basic info
    if (action === 'boards') {
      const boards = await listBoards()
      return NextResponse.json({
        boards,
        connected: true,
      })
    }

    // action=items&boardId=X — fetch items from a specific board
    if (action === 'items' && boardId) {
      const items = await getBoardItemsById(boardId, queryLimit)
      return NextResponse.json({
        boardId,
        items,
        connected: true,
      })
    }

    // action=updates&itemId=X — fetch updates/comments on an item
    if (action === 'updates' && itemId) {
      const updates = await getItemUpdates(itemId, queryLimit)
      return NextResponse.json({
        itemId,
        updates,
        connected: true,
      })
    }

    // Default: return tasks and users (backward compatible)
    const boardIdsParam = request.nextUrl.searchParams.get('boardIds')
    const boardIds = boardIdsParam ? boardIdsParam.split(',') : undefined

    const [tasks, users] = await Promise.all([
      getAllTasks(boardIds),
      getUsers(),
    ])

    return NextResponse.json({
      tasks,
      users,
      connected: true,
    })
  } catch (err) {
    console.error('Monday.com API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch Monday.com data', tasks: [], users: [], boards: [], items: [], updates: [], connected: true },
      { status: 500 }
    )
  }
}
