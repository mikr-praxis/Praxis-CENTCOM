import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getHubSpotClient } from '@/lib/hubspot/client'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''

    const client = await getHubSpotClient()
    const deals = await client.listDeals(limit)

    // Filter by search term if provided
    let filtered = deals
    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = deals.filter(
        (d) =>
          d.dealName.toLowerCase().includes(lowerSearch) ||
          d.dealStage.toLowerCase().includes(lowerSearch)
      )
    }

    return NextResponse.json({
      deals: filtered,
      total: filtered.length,
      limit,
    })
  } catch (error) {
    console.error('HubSpot deals error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch deals'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
