'use client'

import { useState, useEffect } from 'react'
import { Hash, Lock, ChevronDown, RefreshCw } from 'lucide-react'

type Channel = {
  id: string
  name: string
  topic?: string
  purpose?: string
  is_private: boolean
  num_members?: number
}

type ChannelSelectorProps = {
  selectedChannel: string | null
  onSelect: (channelId: string, channelName: string) => void
}

export function ChannelSelector({ selectedChannel, onSelect }: ChannelSelectorProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const fetchChannels = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/slack/channels')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch channels')
      }
      const data = await res.json()
      setChannels(data.channels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChannels()
  }, [])

  const selected = channels.find((c) => c.id === selectedChannel)

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
        <span className="text-xs text-red-400">{error}</span>
        <button onClick={fetchChannels} className="text-red-400 hover:text-red-300">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 transition-colors min-w-[200px]"
      >
        {loading ? (
          <span className="text-slate-500">Loading channels...</span>
        ) : selected ? (
          <>
            {selected.is_private ? (
              <Lock className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <Hash className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span className="flex-1 text-left">{selected.name}</span>
          </>
        ) : (
          <span className="text-slate-500 flex-1 text-left">Select a channel</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>

      {open && !loading && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                onSelect(ch.id, ch.name)
                setOpen(false)
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors ${
                ch.id === selectedChannel ? 'bg-slate-800 text-amber-400' : 'text-slate-300'
              }`}
            >
              {ch.is_private ? (
                <Lock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              ) : (
                <Hash className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="block truncate">{ch.name}</span>
                {ch.purpose && (
                  <span className="block text-xs text-slate-500 truncate">{ch.purpose}</span>
                )}
              </div>
              {ch.num_members !== undefined && (
                <span className="text-xs text-slate-600">{ch.num_members}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
