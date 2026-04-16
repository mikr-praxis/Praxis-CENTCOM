import { WebClient } from '@slack/web-api'
import { getConfig } from '@/lib/config'

// Defaults — overridden by app_config keys SLACK_WRITE_CHANNEL_ID, SLACK_WRITE_CHANNEL_NAME
const DEFAULT_SLACK_CHANNEL_ID = 'C0APYEU7N1M'
const DEFAULT_SLACK_CHANNEL_NAME = 'backend-progress-updates-by-task'

export async function getSlackWriteChannel(): Promise<{ id: string; name: string }> {
  const id = await getConfig('SLACK_WRITE_CHANNEL_ID') || DEFAULT_SLACK_CHANNEL_ID
  const name = await getConfig('SLACK_WRITE_CHANNEL_NAME') || DEFAULT_SLACK_CHANNEL_NAME
  return { id, name }
}

// Legacy exports for backward compat (sync — uses defaults until config loads)
export const SLACK_WRITE_CHANNEL_ID = DEFAULT_SLACK_CHANNEL_ID
export const SLACK_WRITE_CHANNEL_NAME = DEFAULT_SLACK_CHANNEL_NAME

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

// ── Formatting utils (shared across client components) ─────────────────

/** Convert a Slack ts (epoch seconds) to a human-readable string. */
export function formatSlackTs(ts: string): string {
  const date = new Date(Number(ts) * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isToday) return `Today ${time}`
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`
}

/** Strip Slack mrkdwn to plain-ish text for display. */
export function formatSlackText(text: string): string {
  return text
    .replace(/<@(\w+)>/g, '@user')
    .replace(/<#(\w+)\|([^>]+)>/g, '#$2')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
