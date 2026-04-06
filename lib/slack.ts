import { WebClient } from '@slack/web-api'

let slackClient: WebClient | null = null

export function getSlackClient(): WebClient {
  if (!slackClient) {
    const token = process.env.SLACK_BOT_TOKEN
    if (!token) {
      throw new Error(
        'SLACK_BOT_TOKEN is not set. Add it to your environment variables.'
      )
    }
    slackClient = new WebClient(token)
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
