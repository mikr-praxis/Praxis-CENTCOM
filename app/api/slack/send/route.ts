import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSlackClient, SLACK_WRITE_CHANNEL_ID } from '@/lib/slack'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { channel, message, thread_ts } = body

    if (!channel || !message) {
      return NextResponse.json(
        { error: 'channel and message are required' },
        { status: 400 }
      )
    }

    // CentCom can only write to the designated channel
    if (channel !== SLACK_WRITE_CHANNEL_ID) {
      return NextResponse.json(
        { error: 'CentCom can only send messages to #backend-progress-updates-by-task' },
        { status: 403 }
      )
    }

    const slack = getSlackClient()

    // Send the message
    const result = await slack.chat.postMessage({
      channel,
      text: message,
      thread_ts: thread_ts || undefined,
    })

    // Log it to Supabase
    const supabase = createServerClient()
    await supabase.from('message_logs').insert({
      channel_id: channel,
      channel_name: result.channel || channel,
      message_text: message,
      slack_ts: result.ts || null,
      direction: 'outbound',
      user_id: userId,
    })

    return NextResponse.json({
      ok: true,
      ts: result.ts,
      channel: result.channel,
    })
  } catch (error) {
    console.error('Slack send error:', error)
    const message = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
