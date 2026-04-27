'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MessageSquare, RefreshCw, Hash, Reply, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useFormatters } from '@/components/providers/BrandingProvider'
import type { BoundFormatters } from '@/lib/format'

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

type Channel = {
  id: string
  name: string
  is_private: boolean
  num_members?: number
}

function formatSlackTs(ts: string, f: BoundFormatters): string {
  const date = new Date(Number(ts) * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = f.time(date, { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isToday) return time
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  return f.date(date, { month: 'short', day: 'numeric' }) + ` ${time}`
}

function formatSlackText(text: string): string {
  return text
    .replace(/<@(\w+)>/g, '@user')
    .replace(/<#(\w+)\|([^>]+)>/g, '#$2')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function SlackWidget() {
  const f = useFormatters()
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch channels on mount, auto-select first one
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/slack/channels')
        if (!res.ok) throw new Error('Failed to load channels')
        const data = await res.json()
        const chans: Channel[] = data.channels || []
        setChannels(chans)

        // Prefer #general or first channel
        const general = chans.find((c: Channel) => c.name === 'general')
        setSelectedChannel(general || chans[0] || null)
      } catch {
        setError('Slack not connected')
      }
    }
    init()
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!selectedChannel) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/slack/messages?channel=${selectedChannel.id}&limit=8`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [selectedChannel])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchMessages, 60_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-400" />
            <CardTitle>Slack</CardTitle>
            {selectedChannel && (
              <Badge variant="default">
                <Hash className="h-3 w-3 mr-0.5" />
                {selectedChannel.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchMessages}
              disabled={loading}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/comms"
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {/* Channel tabs */}
        {channels.length > 1 && (
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mb-1">
            {channels.slice(0, 5).map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedChannel?.id === ch.id
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {ch.name}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 mb-3">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
        {loading && messages.length === 0 && (
          <div className="text-center py-6">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-500 mx-auto mb-2" />
            <span className="text-xs text-slate-500">Loading...</span>
          </div>
        )}

        {!loading && messages.length === 0 && !error && (
          <p className="text-xs text-slate-500 text-center py-6">No recent messages</p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.ts}
            className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-700/30 transition-colors"
          >
            <div className="h-6 w-6 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-medium text-slate-300">
                {(msg.username || msg.user).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-200">
                  {msg.username || msg.user}
                </span>
                <span className="text-[10px] text-slate-600">{formatSlackTs(msg.ts, f)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 break-words">
                {formatSlackText(msg.text)}
              </p>
              {msg.reply_count && msg.reply_count > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 mt-0.5">
                  <Reply className="h-2.5 w-2.5" />
                  {msg.reply_count}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
