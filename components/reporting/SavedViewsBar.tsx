'use client'

import { useEffect, useState } from 'react'
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react'
import type { TimeframeValue } from './TimeframePicker'
import type { Slicer } from '@/lib/reporting/types'

export interface SavedView {
  id: string
  name: string
  timeframe: TimeframeValue | null
  slicers: Slicer[]
  selected_filenames: string[]
}

interface Props {
  slug: string
  current: {
    timeframe: TimeframeValue
    slicers: Slicer[]
    selected_filenames: string[]
  }
  onApply: (view: SavedView) => void
}

export function SavedViewsBar({ slug, current, onApply }: Props) {
  const [views, setViews] = useState<SavedView[]>([])
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/reporting/${slug}/views`)
      .then((r) => r.json())
      .then((b) => setViews(b.views ?? []))
      .catch(() => {})
  }, [slug])

  async function save() {
    if (!name.trim()) return
    const res = await fetch(`/api/reporting/${slug}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        timeframe: current.timeframe,
        slicers: current.slicers,
        selected_filenames: current.selected_filenames,
      }),
    })
    const body = await res.json()
    if (res.ok && body.view) {
      setViews((prev) => [body.view, ...prev])
      setName('')
      setAdding(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this view?')) return
    const res = await fetch(`/api/reporting/${slug}/views/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setViews((prev) => prev.filter((v) => v.id !== id))
      if (activeId === id) setActiveId(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Bookmark className="h-3.5 w-3.5" /> Views:
      </span>
      {views.length === 0 && !adding && <span className="text-xs text-slate-500">none</span>}
      {views.map((v) => (
        <div
          key={v.id}
          className={
            activeId === v.id
              ? 'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200'
              : 'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800'
          }
        >
          <button
            onClick={() => {
              setActiveId(v.id)
              onApply(v)
            }}
            className="truncate max-w-[160px]"
          >
            {v.name}
          </button>
          <button onClick={() => remove(v.id)} className="text-slate-400 hover:text-red-400">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <BookmarkPlus className="h-3 w-3" /> Save current
        </button>
      ) : (
        <div className="inline-flex items-center gap-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
            autoFocus
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            className="px-2 py-1 text-xs rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setAdding(false)
              setName('')
            }}
            className="px-2 py-1 text-xs rounded text-slate-400 hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
