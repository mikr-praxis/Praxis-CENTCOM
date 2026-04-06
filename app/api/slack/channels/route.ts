import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSlackClient } from '@/lib/slack'
import type { SlackChannel } from '@/lib/slack'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const slack = getSlackClient()
    const result = await slack.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 100,
    })

    const channels: SlackChannel[] = (result.channels || []).map((ch) => ({
      id: ch.id!,
      name: ch.name!,
      topic: ch.topic?.value || undefined,
      purpose: ch.purpose?.value || undefined,
      is_private: ch.is_private || false,
      num_members: ch.num_members,
    }))

    // Sort by name
    channels.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Slack channels error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch channels'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
