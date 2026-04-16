import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSlackClient } from '@/lib/slack'

/**
 * Search for Slack messages matching a project's tag prefix across all channels.
 * Also fetches from a dedicated channel if provided.
 *
 * Query params:
 *   tag    - The tag prefix to search for (e.g. "[B4C]")
 *   channel - Optional dedicated channel ID
 *   limit  - Max messages (default 20)
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag')
  const channelId = searchParams.get('channel')
  const limit = Math.min(Number(searchParams.get('limit') || '20'), 50)

  if (!tag && !channelId) {
    return NextResponse.json(
      { error: 'Either tag or channel is required' },
      { status: 400 }
    )
  }

  try {
    const slack = await getSlackClient()
    const messages: Array<{
      ts: string
      user: string
      username?: string
      text: string
      channel: string
      channel_name?: string
    }> = []

    // Cache user names
    const userCache = new Map<string, string>()
    async function resolveUser(uid: string): Promise<string> {
      if (userCache.has(uid)) return userCache.get(uid)!
      try {
        const info = await slack.users.info({ user: uid })
        const name = info.user?.real_name || info.user?.name || uid
        userCache.set(uid, name)
        return name
      } catch {
        userCache.set(uid, uid)
        return uid
      }
    }

    // Strategy 1: Search by tag across all channels
    if (tag) {
      try {
        const searchResult = await slack.search.messages({
          query: tag,
          sort: 'timestamp',
          sort_dir: 'desc',
          count: limit,
        })

        const matches = searchResult.messages?.matches || []
        for (const match of matches) {
          if (!match.ts || !match.text) continue
          const username = match.user ? await resolveUser(match.user) : match.username || 'Unknown'
          messages.push({
            ts: match.ts,
            user: match.user || 'unknown',
            username,
            text: match.text,
            channel: match.channel?.id || '',
            channel_name: match.channel?.name || undefined,
          })
        }
      } catch (searchErr) {
        // search.messages requires user token, may not work with bot token
        // Fall back to scanning channels if search fails
        console.warn('Slack search.messages failed, falling back to channel scan:', searchErr)
      }
    }

    // Strategy 2: If we have a dedicated channel, fetch its recent history
    if (channelId && messages.length < limit) {
      try {
        const history = await slack.conversations.history({
          channel: channelId,
          limit: limit - messages.length,
        })

        const existingTs = new Set(messages.map((m) => m.ts))

        // Get channel info
        let channelName = ''
        try {
          const chInfo = await slack.conversations.info({ channel: channelId })
          channelName = chInfo.channel?.name || ''
        } catch { /* ignore */ }

        for (const msg of history.messages || []) {
          if (!msg.ts || !msg.text || msg.subtype) continue
          if (existingTs.has(msg.ts)) continue

          const username = msg.user ? await resolveUser(msg.user) : 'Unknown'
          messages.push({
            ts: msg.ts,
            user: msg.user || 'unknown',
            username,
            text: msg.text,
            channel: channelId,
            channel_name: channelName || undefined,
          })
        }
      } catch (chErr) {
        console.error('Channel history fetch failed:', chErr)
      }
    }

    // If tag search didn't work (bot token limitation) and no channel,
    // scan all joined channels for messages containing the tag
    if (tag && messages.length === 0 && !channelId) {
      try {
        const channelsList = await slack.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 100,
        })

        for (const ch of channelsList.channels || []) {
          if (!ch.id || !ch.is_member) continue

          try {
            const history = await slack.conversations.history({
              channel: ch.id,
              limit: 50,
            })

            for (const msg of history.messages || []) {
              if (!msg.ts || !msg.text || msg.subtype) continue
              if (!msg.text.includes(tag)) continue

              const username = msg.user ? await resolveUser(msg.user) : 'Unknown'
              messages.push({
                ts: msg.ts,
                user: msg.user || 'unknown',
                username,
                text: msg.text,
                channel: ch.id,
                channel_name: ch.name || undefined,
              })
            }
          } catch { /* skip channels we can't read */ }

          if (messages.length >= limit) break
        }
      } catch (scanErr) {
        console.error('Channel scan failed:', scanErr)
      }
    }

    // Sort by timestamp descending and limit
    messages.sort((a, b) => Number(b.ts) - Number(a.ts))
    const limited = messages.slice(0, limit)

    return NextResponse.json({ messages: limited })
  } catch (error) {
    console.error('Project messages error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch project messages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
