'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { RefreshCw, MessageSquare, Hash, Reply } from 'lucide-react'

type Message = {
  ts: string
  user: string
  username?: string
  text: string
  channel: string
  channel_name?: string
  thread_ts?: string
  reply_count?: number
}

type SlackFeedProps = {
  channelId: string | null
  channelName: string | null
  refreshKey?: number
}

function formatSlackTs(ts: string): string {
  const date = new Date(Number(ts) * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) return `Today ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ` ${time}`
}

function formatSlackText(text: string): string {
  // Basic Slack mrkdwn → readable text
  return text
    .replace(/<@(\w+)>/g, '@user')
    .replace(/<#(\w+)\|([^>]+)>/g, '#$2')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function SlackFeed({ channelId, channelName, refreshKey }: SlackFeedProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!channelId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/slack/messages?channel=${channelId}&limit=25`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch messages')
      }
      const data = await res.json()
      setMessages(data.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [channelId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages, refreshKey])

  if (!channelId) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Select a channel to view messages</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <Hash className="h-4 w-4 text-slate-500" />
                {channelName || 'Messages'}
              </span>
            </CardTitle>
            <Badge variant="blue">Live</Badge>
          </div>
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 mb-4">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="space-y-1 max-h-[480px] overflow-y-auto">
        {loading && messages.length === 0 && (
          <div className="text-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-500 mx-auto mb-2" />
            <span className="text-sm text-slate-500">Loading messages...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No messages in this channel</p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.ts}
            className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-700/30 transition-colors"
          >
            <div className="h-7 w-7 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-slate-300">
                {(msg.username || msg.user).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">
                  {msg.username || msg.user}
                </span>
                <span className="text-xs text-slate-600">{formatSlackTs(msg.ts)}</span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5 break-words whitespace-pre-wrap">
                {formatSlackText(msg.text)}
              </p>
              {msg.reply_count && msg.reply_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-400 mt-1">
                  <Reply className="h-3 w-3" />
                  {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
