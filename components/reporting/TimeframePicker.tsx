'use client'

import { useState } from 'react'

export type TimeframePreset = '7d' | '30d' | '90d' | 'qtd' | 'ytd' | 'all' | 'custom'

export interface TimeframeValue {
  preset: TimeframePreset
  start: string | null
  end: string | null
}

const PRESETS: { id: TimeframePreset; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'qtd', label: 'QTD' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
]

export function computeTimeframe(preset: TimeframePreset, customStart: string | null, customEnd: string | null): TimeframeValue {
  if (preset === 'custom') {
    return { preset, start: customStart, end: customEnd }
  }
  if (preset === 'all') {
    return { preset, start: null, end: null }
  }
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  let start: Date
  switch (preset) {
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), q * 3, 1)
      break
    }
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
  return { preset, start: start.toISOString().slice(0, 10), end }
}

interface Props {
  value: TimeframeValue
  onChange: (next: TimeframeValue) => void
}

export function TimeframePicker({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(value.preset === 'custom')
  const [customStart, setCustomStart] = useState(value.start ?? '')
  const [customEnd, setCustomEnd] = useState(value.end ?? '')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 p-1 bg-slate-900">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setShowCustom(false)
              onChange(computeTimeframe(p.id, null, null))
            }}
            className={
              value.preset === p.id
                ? 'px-3 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'px-3 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((s) => !s)}
          className={
            value.preset === 'custom' || showCustom
              ? 'px-3 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'px-3 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
          }
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-200"
          />
          <span className="text-xs text-slate-500">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-200"
          />
          <button
            onClick={() => onChange({ preset: 'custom', start: customStart || null, end: customEnd || null })}
            disabled={!customStart && !customEnd}
            className="px-2 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
