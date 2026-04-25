'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Database,
  Settings2,
  Wand2,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { TimeframePicker, computeTimeframe, type TimeframeValue } from '@/components/reporting/TimeframePicker'
import { KPICardGrid } from '@/components/reporting/KPICardGrid'
import { ChartBlock } from '@/components/reporting/ChartBlock'
import { FileBrowser } from '@/components/reporting/FileBrowser'
import { AddClientButton } from '@/components/reporting/AddClientButton'
import type { KPIResult } from '@/lib/reporting/types'
import type { Formula } from '@/lib/reporting/types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

export interface ClientSummary {
  id: string
  slug: string
  name: string
  drive_folder_id: string | null
  funnel_type: string
  file_count: number
  last_synced: string | null
  filenames: string[]
  kpi_count: number
}

interface AISuggestion {
  display_name: string
  key: string
  description: string
  formula: Formula
  format: KPIFormat
  viz_type: KPIVizType
  target: number | null
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

interface Props {
  clients: ClientSummary[]
}

export function ClientsHome({ clients }: Props) {
  const [activeId, setActiveId] = useState<string | null>(clients[0]?.id ?? null)
  const active = clients.find((c) => c.id === activeId) ?? null

  if (clients.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-amber-400" /> Clients
            </h1>
            <p className="text-slate-400 mt-1 text-sm">No clients yet — add your first one.</p>
          </div>
          <AddClientButton />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-400" /> Clients
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Pick a client. Pick the data files you care about. Build a dashboard with AI in seconds.
          </p>
        </div>
        <AddClientButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar list */}
        <aside className="space-y-1">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={
                activeId === c.id
                  ? 'w-full text-left p-3 rounded-lg border border-amber-500/30 bg-amber-500/5'
                  : 'w-full text-left p-3 rounded-lg border border-slate-700/50 bg-slate-900 hover:bg-slate-800/50'
              }
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white truncate">{c.name}</span>
                <FolderOpen
                  className={c.drive_folder_id ? 'h-3.5 w-3.5 text-emerald-400' : 'h-3.5 w-3.5 text-slate-600'}
                />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>{c.file_count} files</span>
                <span>·</span>
                <span>{c.kpi_count} KPIs</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Main panel */}
        <main>{active ? <ClientWorkspace key={active.id} client={active} /> : null}</main>
      </div>
    </div>
  )
}

function ClientWorkspace({ client }: { client: ClientSummary }) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => new Set(client.filenames))
  const [timeframe, setTimeframe] = useState<TimeframeValue>(() => computeTimeframe('30d', null, null))
  const [results, setResults] = useState<KPIResult[]>([])
  const [kpiCount, setKpiCount] = useState(client.kpi_count)
  const [loading, setLoading] = useState(false)

  // Recommendations (heuristic or AI)
  const [recOpen, setRecOpen] = useState(false)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recSource, setRecSource] = useState<'heuristic' | 'ai'>('heuristic')
  const [suggestions, setSuggestions] = useState<AISuggestion[] | null>(null)
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const fetchKpis = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (timeframe.start) params.set('start', timeframe.start)
      if (timeframe.end) params.set('end', timeframe.end)
      const res = await fetch(`/api/reporting/${client.slug}/kpis?${params.toString()}`)
      const body = await res.json()
      setResults(body.results ?? [])
      setKpiCount(body.kpi_count ?? 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [client.slug, timeframe.start, timeframe.end])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  // Filter results by selected files (only show KPIs whose source files are in scope)
  const visibleResults = useMemo(() => {
    if (selectedFiles.size === 0 || selectedFiles.size === client.filenames.length) return results
    return results.filter((r) => r.source_files.every((f) => selectedFiles.has(f)) || r.source_files.length === 0)
  }, [results, selectedFiles, client.filenames.length])

  function toggleFile(name: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function syncNow() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/sync`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Sync failed')
      const r = body.result
      setSyncMsg(
        `Synced ${r.files_synced ?? 0} of ${r.files_seen ?? 0} files (${r.files_skipped ?? 0} unchanged, ${r.files_unsupported ?? 0} unsupported)`
      )
      // Refresh page state — easiest is full reload to pick up new file list
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function recommend(source: 'heuristic' | 'ai') {
    setRecOpen(true)
    setRecLoading(true)
    setRecError(null)
    setSuggestions(null)
    setAccepted(new Set())
    setRecSource(source)
    try {
      const path = source === 'ai' ? 'ai-recommend' : 'heuristic-recommend'
      const res = await fetch(`/api/reporting/${client.slug}/kpis/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames: selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined,
          count: 6,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Recommend failed')
      setSuggestions(body.suggestions ?? [])
      // Default: accept all
      setAccepted(new Set((body.suggestions ?? []).map((_: unknown, i: number) => i)))
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Recommend failed')
    } finally {
      setRecLoading(false)
    }
  }

  function toggleAccept(i: number) {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function saveAccepted() {
    if (!suggestions || accepted.size === 0) return
    setSaving(true)
    try {
      const kpis = suggestions
        .filter((_, i) => accepted.has(i))
        .map((s, idx) => ({
          key: s.key,
          display_name: s.display_name,
          description: s.description,
          formula: s.formula,
          format: s.format,
          viz_type: s.viz_type,
          target: s.target,
          display_order: kpiCount + idx,
        }))
      const res = await fetch(`/api/reporting/${client.slug}/kpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpis }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Save failed')
      setRecOpen(false)
      setSuggestions(null)
      await fetchKpis()
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const allSelected = selectedFiles.size === client.filenames.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-bold text-white">{client.name}</h2>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Pill ok={!!client.drive_folder_id}>
                {client.drive_folder_id ? 'Drive connected' : 'Drive not set'}
              </Pill>
              <Pill ok={client.file_count > 0}>{client.file_count} files synced</Pill>
              <Pill ok={kpiCount > 0}>{kpiCount} KPIs</Pill>
              {client.last_synced && (
                <span className="text-[11px] text-slate-500 self-center">
                  Last sync: {new Date(client.last_synced).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={syncNow}
              disabled={!client.drive_folder_id || syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            <FileBrowser slug={client.slug} filenames={client.filenames} />
            <Link
              href={`/reporting/${client.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" /> Full report
            </Link>
            <Link
              href={`/reporting/${client.slug}/configure`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Settings2 className="h-4 w-4" /> Configure
            </Link>
          </div>
        </div>
        {syncMsg && <p className="text-xs text-emerald-400">{syncMsg}</p>}
        {!client.drive_folder_id && (
          <p className="mt-2 text-xs text-amber-300/80">
            No Drive folder connected.{' '}
            <Link href={`/reporting/${client.slug}`} className="underline">
              Connect one →
            </Link>
          </p>
        )}
      </div>

      {/* Data sources */}
      {client.filenames.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white inline-flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" /> Data sources
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setSelectedFiles(new Set(client.filenames))}
                disabled={allSelected}
                className="text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                Select all
              </button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => setSelectedFiles(new Set())}
                disabled={selectedFiles.size === 0}
                className="text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {client.filenames.map((fn) => (
              <button
                key={fn}
                onClick={() => toggleFile(fn)}
                className={
                  selectedFiles.has(fn)
                    ? 'px-2.5 py-1 text-xs rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'px-2.5 py-1 text-xs rounded-md border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }
              >
                {fn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Build-out — heuristic primary, AI polish */}
      {client.file_count > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <h3 className="text-sm font-semibold text-white inline-flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-amber-300" /> Build a dashboard
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Free heuristic suggester reads column names + types from your selected files. AI version adds context and cross-file reasoning — costs ~$0.20 per call.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => recommend('heuristic')}
                disabled={recLoading || selectedFiles.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" />
                {recLoading && recSource === 'heuristic' ? 'Building…' : 'Recommend (free)'}
              </button>
              <button
                onClick={() => recommend('ai')}
                disabled={recLoading || selectedFiles.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {recLoading && recSource === 'ai' ? 'Thinking…' : 'Polish with AI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeframe + KPIs */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-white">Live KPIs</h3>
          <TimeframePicker value={timeframe} onChange={setTimeframe} slug={client.slug} />
        </div>
        {kpiCount === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 text-slate-400 text-sm">
            {client.file_count === 0
              ? 'No files synced yet. Click Sync Now above.'
              : 'No KPIs yet. Click "Recommend a dashboard" to have AI build a starter set, or Configure manually.'}
          </div>
        ) : (
          <KPICardGrid
            results={visibleResults.filter(
              (r) => r.viz_type === 'card' || r.viz_type === 'pie' || r.viz_type === 'table'
            )}
            loading={loading}
          />
        )}
      </div>

      {/* Trends */}
      {!loading && visibleResults.some((r) => r.viz_type === 'line' || r.viz_type === 'bar') && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Trends</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleResults
              .filter((r) => r.viz_type === 'line' || r.viz_type === 'bar')
              .map((r) => (
                <ChartBlock key={r.kpi_id} result={r} />
              ))}
          </div>
        </div>
      )}

      {/* Recommendation modal */}
      {recOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !saving && setRecOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
              <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                {recSource === 'ai' ? (
                  <><Sparkles className="h-4 w-4 text-indigo-400" /> AI dashboard recommendations</>
                ) : (
                  <><Wand2 className="h-4 w-4 text-amber-400" /> Heuristic dashboard recommendations</>
                )}
              </h2>
              <button
                onClick={() => !saving && setRecOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {recLoading && (
                <p className="text-sm text-slate-400 inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Reading your files and thinking through useful KPIs…
                </p>
              )}
              {recError && (
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{recError}</span>
                </div>
              )}
              {suggestions && suggestions.length === 0 && (
                <p className="text-sm text-slate-400">No suggestions returned.</p>
              )}
              {suggestions && suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <label
                      key={i}
                      className={
                        accepted.has(i)
                          ? 'flex items-start gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 cursor-pointer'
                          : 'flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-950/40 cursor-pointer hover:border-slate-600'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={accepted.has(i)}
                        onChange={() => toggleAccept(i)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-white truncate">{s.display_name}</span>
                          <span
                            className={
                              s.confidence === 'high'
                                ? 'text-[10px] uppercase text-emerald-400'
                                : s.confidence === 'medium'
                                  ? 'text-[10px] uppercase text-amber-400'
                                  : 'text-[10px] uppercase text-red-400'
                            }
                          >
                            {s.confidence}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 mt-1.5">
                          <span className="font-mono">format: {s.format}</span>
                          <span className="font-mono">viz: {s.viz_type}</span>
                          {s.target != null && <span className="font-mono">target: {s.target}</span>}
                        </div>
                        {s.notes && <p className="text-[11px] text-slate-500 mt-1 italic">{s.notes}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="p-4 border-t border-slate-700/50 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {accepted.size} of {suggestions.length} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAccepted(new Set(suggestions.map((_, i) => i)))}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
                  >
                    Select all
                  </button>
                  <button
                    onClick={saveAccepted}
                    disabled={saving || accepted.size === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Saving…' : `Save ${accepted.size} KPI${accepted.size === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        ok
          ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
          : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800 border border-slate-700 text-slate-400'
      }
    >
      {ok && <Check className="h-3 w-3" />}
      {children}
    </span>
  )
}
