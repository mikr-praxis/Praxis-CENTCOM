import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getHubSpotClient } from '@/lib/hubspot/client'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getHubSpotClient()

    // Get pipeline stages
    const stages = await client.getPipeline()

    // Get all deals
    const deals = await client.listDeals(250)

    // Group deals by stage and calculate totals
    const dealsByStage: Record<string, typeof deals> = {}
    let totalPipeline = 0

    for (const deal of deals) {
      if (!dealsByStage[deal.dealStage]) {
        dealsByStage[deal.dealStage] = []
      }
      dealsByStage[deal.dealStage].push(deal)
      totalPipeline += deal.amount
    }

    // Create summary with stage info
    const summary = stages.map((stage) => ({
      stageId: stage.id,
      stageName: stage.label,
      displayOrder: stage.displayOrder,
      dealCount: (dealsByStage[stage.id] || []).length,
      totalValue: (dealsByStage[stage.id] || []).reduce((sum, d) => sum + d.amount, 0),
      deals: dealsByStage[stage.id] || [],
    }))

    return NextResponse.json({
      summary,
      totalPipeline,
      dealCount: deals.length,
      stageCount: stages.length,
    })
  } catch (error) {
    console.error('HubSpot error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch HubSpot data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
