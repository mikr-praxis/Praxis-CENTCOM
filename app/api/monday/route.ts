import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllTasks, getUsers } from '@/lib/monday/client'

// GET /api/monday?boardIds=123,456  (optional — fetches all boards if omitted)
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Monday.com is configured
  if (!process.env.MONDAY_API_KEY) {
    return NextResponse.json({
      tasks: [],
      users: [],
      connected: false,
    })
  }

  try {
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
      { error: 'Failed to fetch Monday.com data', tasks: [], users: [], connected: true },
      { status: 500 }
    )
  }
}
