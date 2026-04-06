'use client'

import { useState } from 'react'
import { Send, Hash } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type SlackComposerProps = {
  channelId: string | null
  channelName: string | null
  onMessageSent: () => void
}

export function SlackComposer({ channelId, channelName, onMessageSent }: SlackComposerProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!channelId || !message.trim()) return

    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/slack/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelId, message: message.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      setMessage('')
      onMessageSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!channelId) return null

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs text-slate-500">
          Sending to <span className="text-slate-400 font-medium">{channelName}</span>
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 mb-2">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          size="sm"
        >
          <Send className={`h-4 w-4 ${sending ? 'opacity-50' : ''}`} />
        </Button>
      </div>
      <p className="text-xs text-slate-600 mt-1.5">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
