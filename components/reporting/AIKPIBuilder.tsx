'use client'

import { useState } from 'react'
import { Sparkles, X, Wand2, AlertCircle } from 'lucide-react'
import type { Formula } from '@/lib/reporting/types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

export interface AIDraft {
  display_name: string
  key: string
  description: string
  formula: Formula
  format: KPIFormat
  viz_type: KPIVizType
  target: number | null
}

interface Props {
  slug: string
  filenames: string[]
  onAccept: (draft: AIDraft) => void
}

export function AIKPIBuilder({ slug, filenames, onAccept }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [scopedFiles, setScopedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<{
    display_name: string
    key: string
    description: string
    formula: Formula
    format: KPIFormat
    viz_type: KPIVizType
    target: number | null
    confidence: 'high' | 'medium' | 'low'
    notes: string
  } | null>(null)

  async function generate() {
    if (!description.trim()) {
      setError('Describe what you want to measure first.')
      return
    }
    setLoading(true)
    setError(null)
    setSuggestion(null)
    try {
      const res = await fetch(`/api/reporting/${slug}/kpis/ai-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          filenames: scopedFiles.size > 0 ? Array.from(scopedFiles) : undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
      setSuggestion(body.suggestion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI suggestion failed')
    } finally {
      setLoading(false)
    }
  }

  function accept() {
    if (!suggestion) return
    onAccept({
      display_name: suggestion.display_name,
      key: suggestion.key,
      description: suggestion.description,
      formula: suggestion.formula,
      format: suggestion.format,
      viz_type: suggestion.viz_type,
      target: suggestion.target,
    })
    setOpen(false)
    setDescription('')
    setSuggestion(null)
  }

  function toggleFile(filename: string) {
    setScopedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={filenames.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        Build with AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" /> Build a KPI with AI
              </h2>
              <button
                onClick={() => !loading && setOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Describe the metric in plain English. Claude reads your synced files (columns + sample rows) and generates a formula you can review.
            </p>

            <label className="block mb-3">
              <span className="block text-xs text-slate-400 mb-1">What do you want to measure?</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. Conversion rate from leads to closed deals this month — only count deals where status = won"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
              />
            </label>

            {filenames.length > 1 && (
              <div className="mb-3">
                <span className="block text-xs text-slate-400 mb-1">
                  Limit to specific files (optional — defaults to all synced files)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {filenames.map((fn) => (
                    <button
                      key={fn}
                      onClick={() => toggleFile(fn)}
                      className={
                        scopedFiles.has(fn)
                          ? 'px-2 py-1 text-xs rounded border border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                          : 'px-2 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:bg-slate-800'
                      }
                    >
                      {fn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={generate}
              disabled={loading || !description.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {loading ? 'Thinking…' : 'Generate'}
            </button>

            {error && (
              <div className="mt-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {suggestion && (
              <div className="mt-4 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-white">{suggestion.display_name}</h3>
                  <span
                    className={
                      suggestion.confidence === 'high'
                        ? 'text-[10px] uppercase tracking-wide text-emerald-400'
                        : suggestion.confidence === 'medium'
                          ? 'text-[10px] uppercase tracking-wide text-amber-400'
                          : 'text-[10px] uppercase tracking-wide text-red-400'
                    }
                  >
                    {suggestion.confidence} confidence
                  </span>
                </div>
                <p className="text-sm text-slate-300">{suggestion.description}</p>
                <div className="text-[11px] text-slate-500 grid grid-cols-2 gap-x-3 gap-y-0.5 pt-2 border-t border-slate-800">
                  <span>Format: <span className="text-slate-300 font-mono">{suggestion.format}</span></span>
                  <span>Viz: <span className="text-slate-300 font-mono">{suggestion.viz_type}</span></span>
                  <span>Key: <span className="text-slate-300 font-mono">{suggestion.key}</span></span>
                  <span>Target: <span className="text-slate-300 font-mono">{suggestion.target ?? '—'}</span></span>
                </div>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  <span className="block uppercase tracking-wide text-slate-600 mb-1">Notes</span>
                  <p className="text-slate-400">{suggestion.notes}</p>
                </div>
                <details className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-200">Raw formula JSON</summary>
                  <pre className="mt-1 p-2 rounded bg-slate-950 text-slate-400 overflow-x-auto text-[10px]">
{JSON.stringify(suggestion.formula, null, 2)}
                  </pre>
                </details>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSuggestion(null)}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
                  >
                    Try again
                  </button>
                  <button
                    onClick={accept}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20"
                  >
                    Use this — load into editor
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
