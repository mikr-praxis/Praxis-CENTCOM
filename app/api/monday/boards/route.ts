import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listBoards, getBoardItemsById, createItem } from '@/lib/monday/client'
import { hasConfig } from '@/lib/config'

// GET /api/monday/boards — list all boards with summary info
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Monday.com is configured
  if (!(await hasConfig('MONDAY_API_KEY'))) {
    return NextResponse.json({
      boards: [],
      connected: false,
    })
  }

  try {
    const boards = await listBoards()

    // Optionally fetch item counts for each board
    const withCounts = await Promise.all(
      boards.map(async (board) => {
        try {
          const items = await getBoardItemsById(board.id, 1) // Just check if items exist
          return {
            ...board,
            itemCount: items.length > 0 ? items.length : 0,
          }
        } catch {
          // If we can't fetch items, just return board without count
          return {
            ...board,
            itemCount: 0,
          }
        }
      })
    )

    return NextResponse.json({
      boards: withCounts,
      connected: true,
    })
  } catch (err) {
    console.error('Monday.com boards API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch Monday.com boards', boards: [], connected: true },
      { status: 500 }
    )
  }
}

// POST /api/monday/boards — create item on a board
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Monday.com is configured
  if (!(await hasConfig('MONDAY_API_KEY'))) {
    return NextResponse.json(
      { error: 'Monday.com is not configured' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { boardId, groupId, itemName, columnValues } = body as {
      boardId?: string
      groupId?: string
      itemName?: string
      columnValues?: Record<string, unknown>
    }

    // Validate required fields
    if (!boardId || !groupId || !itemName) {
      return NextResponse.json(
        { error: 'Missing required fields: boardId, groupId, itemName' },
        { status: 400 }
      )
    }

    const newItem = await createItem(boardId, groupId, itemName, columnValues)

    return NextResponse.json({
      item: newItem,
      connected: true,
    })
  } catch (err) {
    console.error('Monday.com item creation error:', err)
    return NextResponse.json(
      { error: 'Failed to create item on Monday.com', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
