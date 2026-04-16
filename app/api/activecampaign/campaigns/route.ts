import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasConfig } from '@/lib/config'
import { listCampaigns, calculateCampaignStats } from '@/lib/activecampaign/client'

/**
 * GET /api/activecampaign/campaigns?limit=50
 * Returns paginated campaign list with stats.
 * Requires Clerk auth.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Active Campaign is configured
  const isConfigured = await hasConfig('ACTIVECAMPAIGN_API_KEY')
  if (!isConfigured) {
    return NextResponse.json({
      campaigns: [],
      connected: false,
    })
  }

  try {
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50

    const campaigns = await listCampaigns(limit)

    // Enrich each campaign with calculated stats
    const enrichedCampaigns = campaigns.map((campaign) => ({
      ...campaign,
      stats: calculateCampaignStats(campaign),
    }))

    return NextResponse.json({
      campaigns: enrichedCampaigns,
      connected: true,
      count: enrichedCampaigns.length,
    })
  } catch (err) {
    console.error('Active Campaign API error:', err)
    return NextResponse.json(
      {
        error: 'Failed to fetch campaign list',
        campaigns: [],
        connected: true,
      },
      { status: 500 }
    )
  }
}
