import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSlackClient } from '@/lib/slack'
import type { SlackMessage } from '@/lib/slack'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channel')
  const limit = Math.min(Number(searchParams.get('limit') || '25'), 50)

  if (!channelId) {
    return NextResponse.json(
      { error: 'channel query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const slack = await getSlackClient()

    // Fetch messages
    const history = await slack.conversations.history({
      channel: channelId,
      limit,
    })

    // Get channel info for the name
    const channelInfo = await slack.conversations.info({ channel: channelId })
    const channelName = channelInfo.channel?.name || channelId

    // Collect unique user IDs to resolve display names
    const userIds = new Set<string>()
    for (const msg of history.messages || []) {
      if (msg.user) userIds.add(msg.user)
    }

    // Batch resolve user names
    const userMap: Record<string, string> = {}
    for (const uid of userIds) {
      try {
        const userInfo = await slack.users.info({ user: uid })
        userMap[uid] =
          userInfo.user?.profile?.display_name ||
          userInfo.user?.real_name ||
          userInfo.user?.name ||
          uid
      } catch {
        userMap[uid] = uid
      }
    }

    const messages: SlackMessage[] = (history.messages || [])
      .filter((msg) => msg.type === 'message' && !msg.subtype)
      .map((msg) => ({
        ts: msg.ts!,
        user: msg.user || 'unknown',
        username: userMap[msg.user || ''] || msg.user || 'Unknown',
        text: msg.text || '',
        channel: channelId,
        channel_name: channelName,
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count,
      }))

    return NextResponse.json({ messages, channel_name: channelName })
  } catch (error) {
    console.error('Slack messages error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch messages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
