import { WebClient } from '@slack/web-api'
import { getConfig } from '@/lib/config'

// The only channel CentCom is allowed to write to
export const SLACK_WRITE_CHANNEL_ID = 'C0APYEU7N1M'
export const SLACK_WRITE_CHANNEL_NAME = 'backend-progress-updates-by-task'

let slackClient: WebClient | null = null
let _slackToken: string | null = null

export async function getSlackClient(): Promise<WebClient> {
  const token = await getConfig('SLACK_BOT_TOKEN')
  if (!token) {
    throw new Error(
      'SLACK_BOT_TOKEN is not set. Configure it at /config.'
    )
  }

  // Re-create client if token changed (hot-swap after config edit)
  if (!slackClient || _slackToken !== token) {
    slackClient = new WebClient(token)
    _slackToken = token
  }
  return slackClient
}

export type SlackChannel = {
  id: string
  name: string
  topic?: string
  purpose?: string
  is_private: boolean
  num_members?: number
}

export type SlackMessage = {
  ts: string
  user: string
  username?: string
  text: string
  channel: string
  channel_name?: string
  thread_ts?: string
  reply_count?: number
}
