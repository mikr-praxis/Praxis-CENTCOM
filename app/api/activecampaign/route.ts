import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasConfig } from '@/lib/config'
import { listCampaigns, listAutomations, calculateCampaignStats } from '@/lib/activecampaign/client'

/**
 * GET /api/activecampaign
 * Returns campaign summary with recent campaigns and automation stats.
 * Requires Clerk auth.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Active Campaign is configured
  const isConfigured = await hasConfig('ACTIVECAMPAIGN_API_KEY')
  if (!isConfigured) {
    return NextResponse.json({
      campaigns: [],
      automations: [],
      summary: {
        totalCampaigns: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
        totalAutomations: 0,
        activeAutomations: 0,
      },
      connected: false,
    })
  }

  try {
    const [campaignsData, automationsData] = await Promise.all([
      listCampaigns(20), // Get recent 20 campaigns
      listAutomations(50),
    ])

    // Calculate stats from campaigns
    const campaignStats = campaignsData
      .filter((c) => c.sends && c.sends > 0) // Only campaigns with sends
      .map(calculateCampaignStats)

    const avgOpenRate =
      campaignStats.length > 0
        ? campaignStats.reduce((sum, s) => sum + s.openRate, 0) / campaignStats.length
        : 0

    const avgClickRate =
      campaignStats.length > 0
        ? campaignStats.reduce((sum, s) => sum + s.clickRate, 0) / campaignStats.length
        : 0

    const activeAutomations = automationsData.filter((a) => a.status === 'published').length

    return NextResponse.json({
      campaigns: campaignsData,
      automations: automationsData,
      summary: {
        totalCampaigns: campaignsData.length,
        avgOpenRate: Math.round(avgOpenRate * 100) / 100,
        avgClickRate: Math.round(avgClickRate * 100) / 100,
        totalAutomations: automationsData.length,
        activeAutomations,
      },
      connected: true,
    })
  } catch (err) {
    console.error('Active Campaign API error:', err)
    return NextResponse.json(
      {
        error: 'Failed to fetch Active Campaign data',
        campaigns: [],
        automations: [],
        summary: {
          totalCampaigns: 0,
          avgOpenRate: 0,
          avgClickRate: 0,
          totalAutomations: 0,
          activeAutomations: 0,
        },
        connected: true,
      },
      { status: 500 }
    )
  }
}
