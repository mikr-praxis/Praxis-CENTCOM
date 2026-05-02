'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Sparkles,
  RefreshCw,
  Database,
  Settings2,
  Wand2,
  Check,
  AlertCircle,
  Printer,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Filter as FilterIcon,
  X,
  MoreHorizontal,
  AlertTriangle,
  Share2,
  FileText,
} from 'lucide-react'
import { TimeframePicker, computeTimeframe, type TimeframeValue } from '@/components/reporting/TimeframePicker'
import { KPICardGrid } from '@/components/reporting/KPICardGrid'
import { ChartBlock } from '@/components/reporting/ChartBlock'
import { PieBlock, TableBlock, GaugeBlock } from '@/components/reporting/VizBlocks'
import { FileBrowser } from '@/components/reporting/FileBrowser'
import { AddClientButton } from '@/components/reporting/AddClientButton'
import { SlicersBar } from '@/components/reporting/SlicersBar'
import { SavedViewsBar, type SavedView } from '@/components/reporting/SavedViewsBar'
import { ShareDialog } from '@/components/reporting/ShareDialog'
import { DriveFolderConfigurator } from '@/components/reporting/DriveFolderConfigurator'
import { WeeklyReportPanel } from '@/components/reporting/WeeklyReportPanel'
import { StandardKPITiles } from '@/components/reporting/StandardKPITiles'
import { AddKPITileMenu } from '@/components/reporting/AddKPITileMenu'
import { isStandardKey } from '@/lib/reporting/kpi-catalog'
import type { KPIResult, Slicer, Formula } from '@/lib/reporting/types'
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
  /** From app_config REPORTING_DEFAULT_KPI_COUNT (Hardcoded tab). Defaults to 6. */
  defaultKpiCount?: number
  /** From app_config REPORTING_DEFAULT_TIMEFRAME (Hardcoded tab). Defaults to '30d'. */
  defaultTimeframe?: string
  /** From app_config REPORTING_DEFAULT_FUNNEL_TYPE. Defaults to 'call'. */
  defaultFunnelType?: 'call' | 'webinar' | 'challenge'
}

export function ClientsHome({
  clients,
  defaultKpiCount = 6,
  defaultTimeframe = '30d',
  defaultFunnelType = 'call',
}: Props) {
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
          <AddClientButton defaultFunnelType={defaultFunnelType} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <ClientHeaderBar
        clients={clients}
        active={active}
        onPick={setActiveId}
        defaultFunnelType={defaultFunnelType}
      />
      {active && (
        <Workspace
          key={active.id}
          client={active}
          defaultKpiCount={defaultKpiCount}
          defaultTimeframe={defaultTimeframe}
        />
      )}
    </div>
  )
}

/* ───────────────────────────── Header bar ───────────────────────────── */

function ClientHeaderBar({
  clients,
  active,
  onPick,
  defaultFunnelType,
}: {
  clients: ClientSummary[]
  active: ClientSummary | null
  onPick: (id: string) => void
  defaultFunnelType: 'call' | 'webinar' | 'challenge'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, query])

  return (
    <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 print:static print:border-0">
      <div className="px-4 sm:px-6 lg:px-8 py-3 max-w-[1600px] mx-auto flex items-center gap-3">
        {/* Client selector */}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 min-w-[220px]"
          >
            <BarChart3 className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {active?.name ?? 'Pick a client'}
              </div>
              {active && (
                <div className="text-[10px] text-slate-500">
                  {active.file_count} files · {active.kpi_count} KPIs
                </div>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute z-20 mt-1 w-[320px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                <div className="p-2 border-b border-slate-800 flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search clients…"
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onPick(c.id)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={
                        c.id === active?.id
                          ? 'w-full text-left px-3 py-2 bg-amber-500/10 border-l-2 border-amber-500'
                          : 'w-full text-left px-3 py-2 hover:bg-slate-800/60 border-l-2 border-transparent'
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white truncate">{c.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                          {c.file_count}f · {c.kpi_count}k
                        </span>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="px-3 py-3 text-xs text-slate-500">No matches.</p>
                  )}
                </div>
                <div className="p-2 border-t border-slate-800">
                  <AddClientButton defaultFunnelType={defaultFunnelType} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Status pills inline */}
        {active && (
          <div className="hidden md:flex items-center gap-1.5 flex-wrap min-w-0">
            <Pill ok={!!active.drive_folder_id} compact>
              {active.drive_folder_id ? 'Drive' : 'No Drive'}
            </Pill>
            <Pill ok={active.file_count > 0} compact>
              {active.file_count} files
            </Pill>
            <Pill ok={active.kpi_count > 0} compact>
              {active.kpi_count} KPIs
            </Pill>
            {active.last_synced && <FreshnessPill lastSynced={active.last_synced} />}
          </div>
        )}

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-1.5 print:hidden">
          {active && <ActionMenu client={active} />}
        </div>
      </div>
    </div>
  )
}

function ActionMenu({ client }: { client: ClientSummary }) {
  const [moreOpen, setMoreOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('praxis:sync', { detail: client.slug }))}
        disabled={!client.drive_folder_id}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Sync
      </button>
      <Link
        href={`/reporting/${client.slug}/configure`}
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
      >
        <Settings2 className="h-3.5 w-3.5" /> Configure
      </Link>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('praxis:open-build'))}
        disabled={client.file_count === 0}
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 disabled:opacity-50"
      >
        <Wand2 className="h-3.5 w-3.5" /> Build
      </button>
      <div className="relative">
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('praxis:open-browser'))
                  setMoreOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <Database className="h-3.5 w-3.5" /> Browse data
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('praxis:open-share'))
                  setMoreOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <Share2 className="h-3.5 w-3.5" /> Share with client
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('praxis:toggle-drive'))
                  setMoreOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <Settings2 className="h-3.5 w-3.5" /> Drive folder settings
              </button>
              <Link
                href={`/reporting/${client.slug}/configure`}
                onClick={() => setMoreOpen(false)}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2 sm:hidden"
              >
                <Settings2 className="h-3.5 w-3.5" /> Configure
              </Link>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('praxis:open-weekly-report'))
                  setMoreOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-amber-300 hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" /> Weekly Report (AI)
              </button>
              <button
                onClick={() => {
                  window.print()
                  setMoreOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <Printer className="h-3.5 w-3.5" /> Export PDF
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ───────────────────────────── Workspace ───────────────────────────── */

function Workspace({
  client,
  defaultKpiCount,
  defaultTimeframe,
}: {
  client: ClientSummary
  defaultKpiCount: number
  defaultTimeframe: string
}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => new Set(client.filenames))
  const [timeframe, setTimeframe] = useState<TimeframeValue>(() =>
    computeTimeframe(defaultTimeframe as Parameters<typeof computeTimeframe>[0], null, null)
  )
  const [slicers, setSlicers] = useState<Slicer[]>([])
  const [results, setResults] = useState<KPIResult[]>([])
  const [kpiCount, setKpiCount] = useState(client.kpi_count)
  const [loading, setLoading] = useState(false)

  const [browserOpen, setBrowserOpen] = useState(false)
  const [buildOpen, setBuildOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [driveConfigOpen, setDriveConfigOpen] = useState(false)
  const [rawFilesOpen, setRawFilesOpen] = useState(false)
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false)

  // Build modal state
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recSource, setRecSource] = useState<'heuristic' | 'ai' | 'template'>('heuristic')
  const [recMissingRoles, setRecMissingRoles] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<AISuggestion[] | null>(null)
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [savingSuggestions, setSavingSuggestions] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  // Track which client IDs we've already auto-synced this page-load, so a
  // back-and-forth between clients doesn't trigger redundant syncs.
  const autoSyncedRef = useRef<Set<string>>(new Set())

  // Auto-sync on first open of a client when its data is stale or missing.
  // Fire-and-forget — the page renders cached data immediately and tiles
  // refresh via the praxis:synced event when the sync resolves.
  // Threshold: never-synced OR last sync > 1 hour ago.
  useEffect(() => {
    if (autoSyncedRef.current.has(client.id)) return
    if (!client.drive_folder_id) return
    const stale =
      !client.last_synced ||
      Date.now() - new Date(client.last_synced).getTime() > 60 * 60 * 1000
    if (!stale) return
    autoSyncedRef.current.add(client.id)
    // Don't await — let the page paint first. syncNow() handles its own state.
    void syncNow({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, client.drive_folder_id, client.last_synced])

  // Listen for header actions
  useEffect(() => {
    const onSync = () => syncNow()
    const onBuild = () => setBuildOpen(true)
    const onBrowse = () => setBrowserOpen(true)
    const onShare = () => setShareOpen(true)
    const onToggleDrive = () => setDriveConfigOpen((o) => !o)
    const onWeeklyReport = () => setWeeklyReportOpen(true)
    window.addEventListener('praxis:sync', onSync)
    window.addEventListener('praxis:open-build', onBuild)
    window.addEventListener('praxis:open-browser', onBrowse)
    window.addEventListener('praxis:open-share', onShare)
    window.addEventListener('praxis:toggle-drive', onToggleDrive)
    window.addEventListener('praxis:open-weekly-report', onWeeklyReport)
    return () => {
      window.removeEventListener('praxis:sync', onSync)
      window.removeEventListener('praxis:open-build', onBuild)
      window.removeEventListener('praxis:open-browser', onBrowse)
      window.removeEventListener('praxis:open-share', onShare)
      window.removeEventListener('praxis:toggle-drive', onToggleDrive)
      window.removeEventListener('praxis:open-weekly-report', onWeeklyReport)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Effective slicers = manual slicers + an implicit slicer for the picker's
  // selected event (column = value). If the user manually added a slicer for
  // the same (file, column), the event slicer overrides it.
  const effectiveSlicers = useMemo(() => {
    const evt = timeframe.event
    if (!evt || !evt.filename || !evt.column || !evt.value) return slicers
    const filtered = slicers.filter((s) => !(s.filename === evt.filename && s.column === evt.column))
    return [...filtered, { filename: evt.filename, column: evt.column, values: [evt.value] }]
  }, [slicers, timeframe.event])

  const fetchKpis = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (timeframe.start) params.set('start', timeframe.start)
      if (timeframe.end) params.set('end', timeframe.end)
      if (effectiveSlicers.length > 0) params.set('slicers', JSON.stringify(effectiveSlicers))
      const res = await fetch(`/api/reporting/${client.slug}/kpis?${params.toString()}`)
      const body = await res.json()
      setResults(body.results ?? [])
      setKpiCount(body.kpi_count ?? 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [client.slug, timeframe.start, timeframe.end, effectiveSlicers])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  const visibleResults = useMemo(() => {
    if (selectedFiles.size === 0 || selectedFiles.size === client.filenames.length) return results
    return results.filter(
      (r) => r.source_files.length === 0 || r.source_files.every((f) => selectedFiles.has(f))
    )
  }, [results, selectedFiles, client.filenames.length])

  function toggleFile(name: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function syncNow(opts: { silent?: boolean } = {}) {
    setSyncing(true)
    if (!opts.silent) setSyncMsg(null)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/sync`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Sync failed')
      const r = body.result
      const summary = `Synced ${r.files_synced ?? 0} of ${r.files_seen ?? 0} files (${r.files_skipped ?? 0} unchanged, ${r.files_unsupported ?? 0} unsupported)`
      // Tell the standard tiles + KPI grid to refetch.
      window.dispatchEvent(new CustomEvent('praxis:synced', { detail: { slug: client.slug, result: r } }))
      if (opts.silent) {
        // Auto-sync path — only reload when files actually changed (so a quick
        // background "nothing-new" sync doesn't blow away client state).
        if ((r.files_synced ?? 0) > 0) {
          setSyncMsg(summary)
          setTimeout(() => window.location.reload(), 600)
        }
      } else {
        setSyncMsg(summary)
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (e) {
      // Surface manual-sync errors; swallow auto-sync errors so failed
      // background syncs don't pollute the UI.
      if (!opts.silent) setSyncMsg(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function recommend(source: 'heuristic' | 'ai' | 'template', templateId?: string) {
    setBuildOpen(true)
    setRecLoading(true)
    setRecError(null)
    setSuggestions(null)
    setAccepted(new Set())
    setRecSource(source)
    setRecMissingRoles([])
    try {
      let path = 'heuristic-recommend'
      let extra: Record<string, unknown> = {}
      if (source === 'ai') path = 'ai-recommend'
      if (source === 'template') {
        path = 'template'
        extra = { template_id: templateId ?? 'marketing_webinar' }
      }
      const res = await fetch(`/api/reporting/${client.slug}/kpis/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames: selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined,
          count: defaultKpiCount,
          ...extra,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Recommend failed')
      setSuggestions(body.suggestions ?? [])
      setRecMissingRoles(body.missing_roles ?? [])
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
    setSavingSuggestions(true)
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
      setBuildOpen(false)
      setSuggestions(null)
      await fetchKpis()
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingSuggestions(false)
    }
  }

  // Standard tiles (std_*) render in their own row above the grid; filter them
  // out of the regular grid so they don't appear twice (once with timeframe
  // applied, once lifetime).
  const nonStandardResults = visibleResults.filter((r) => !isStandardKey(r.key))
  const cardResults = nonStandardResults.filter((r) => r.viz_type === 'card')
  const trendResults = nonStandardResults.filter(
    (r) => r.viz_type === 'line' || r.viz_type === 'bar' || r.viz_type === 'area'
  )
  const pieResults = nonStandardResults.filter((r) => r.viz_type === 'pie')
  const tableResults = nonStandardResults.filter((r) => r.viz_type === 'table')
  const gaugeResults = nonStandardResults.filter((r) => r.viz_type === 'gauge')

  // Catalog keys already configured for this client — drives the "added"
  // badge in AddKPITileMenu and prevents duplicate-add flows.
  const existingKeys = useMemo(() => new Set(results.map((r) => r.key)), [results])
  const hasCustomKpis = nonStandardResults.length > 0

  // Per-tile config: navigate to the dedicated single-KPI editor at
  // /kpi-config/[slug]/[kpiId]. Each tile gets its own focused view —
  // formula, viz type, advanced options + chart options for one tile only.
  const onConfigureKPI = useCallback(
    (result: KPIResult) => {
      window.location.href = `/kpi-config/${client.slug}/${result.kpi_id}`
    },
    [client.slug]
  )

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-[1600px] mx-auto">
      {/* Sync feedback toast */}
      {(syncing || syncMsg) && (
        <div className={syncing ? 'mb-3 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs' : 'mb-3 p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 text-xs'}>
          {syncing ? <>Syncing…</> : syncMsg}
        </div>
      )}

      {/* Drive folder configurator — shows automatically if not connected, on-demand otherwise */}
      {(!client.drive_folder_id || driveConfigOpen) && (
        <div className="mb-3">
          {!client.drive_folder_id && (
            <div className="mb-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>No Drive folder connected for {client.name}. Paste an ID below to enable sync.</span>
            </div>
          )}
          <DriveFolderConfigurator
            slug={client.slug}
            clientName={client.name}
            initialFolderId={client.drive_folder_id}
            defaultOpen
          />
        </div>
      )}

      {/* Standard (lifetime) tiles — always-on, ignore the timeframe picker */}
      {client.drive_folder_id && client.file_count > 0 && (
        <StandardKPITiles slug={client.slug} filenames={client.filenames} />
      )}

      {/* Filter strip */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 mb-3 space-y-2 print:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <TimeframePicker value={timeframe} onChange={setTimeframe} slug={client.slug} />
          {client.file_count > 0 && (
            <SlicersBar
              slug={client.slug}
              files={client.filenames.map((fn) => ({ filename: fn, columns: [] }))}
              slicers={slicers}
              onChange={setSlicers}
            />
          )}
        </div>
        {timeframe.event && timeframe.event.value && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
            <span className="text-xs text-slate-500">Event filter:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
              <span className="font-mono text-[10px] text-emerald-300/70">
                {timeframe.event.filename}.{timeframe.event.column}
              </span>
              <span className="text-emerald-100">=</span>
              <span className="truncate max-w-[200px]">{timeframe.event.value}</span>
              <button
                onClick={() => setTimeframe(computeTimeframe('30d', null, null))}
                className="ml-1 text-emerald-300 hover:text-emerald-100"
                title="Clear event filter and reset timeframe"
              >
                ×
              </button>
            </span>
            <span className="text-[10px] text-slate-500">
              All KPIs whose source contains <span className="font-mono">{timeframe.event.column}</span> are filtered. Others use the date range.
            </span>
          </div>
        )}
        {client.file_count > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-800/60">
            <SavedViewsBar
              slug={client.slug}
              current={{
                // Save the timeframe (incl. event metadata) + ONLY the manual
                // slicers — the event slicer is implicit and re-derived on apply.
                timeframe,
                slicers,
                selected_filenames: Array.from(selectedFiles),
              }}
              onApply={(v: SavedView) => {
                if (v.timeframe) setTimeframe(v.timeframe)
                setSlicers(v.slicers ?? [])
                if (Array.isArray(v.selected_filenames) && v.selected_filenames.length > 0) {
                  setSelectedFiles(new Set(v.selected_filenames))
                }
              }}
            />
            <FilesToggle
              filenames={client.filenames}
              selectedFiles={selectedFiles}
              onChange={setSelectedFiles}
              onToggle={toggleFile}
            />
          </div>
        )}
      </div>

      {/* KPI Grid */}
      {client.file_count > 0 && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Custom tiles</h3>
          <AddKPITileMenu
            slug={client.slug}
            filenames={client.filenames}
            existingKeys={existingKeys}
            onAdded={fetchKpis}
          />
        </div>
      )}
      {!hasCustomKpis && !loading ? (
        <EmptyKPIs
          fileCount={client.file_count}
          onBuild={() => setBuildOpen(true)}
          onSync={syncNow}
          syncing={syncing}
          driveConnected={!!client.drive_folder_id}
        />
      ) : (
        <>
          <KPICardGrid
            results={cardResults}
            loading={loading}
            slug={client.slug}
            timeframe={timeframe}
            slicers={effectiveSlicers}
            onConfigure={onConfigureKPI}
          />
          {gaugeResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Gauges</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {gaugeResults.map((r) => (
                  <GaugeBlock key={r.kpi_id} result={r} onConfigure={() => onConfigureKPI(r)} />
                ))}
              </div>
            </div>
          )}
          {trendResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Trends</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {trendResults.map((r) => (
                  <ChartBlock key={r.kpi_id} result={r} onConfigure={() => onConfigureKPI(r)} />
                ))}
              </div>
            </div>
          )}
          {pieResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Breakdowns</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {pieResults.map((r) => (
                  <PieBlock key={r.kpi_id} result={r} onConfigure={() => onConfigureKPI(r)} />
                ))}
              </div>
            </div>
          )}
          {tableResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wide text-slate-500">Tables</h3>
              {tableResults.map((r) => (
                <TableBlock key={r.kpi_id} result={r} onConfigure={() => onConfigureKPI(r)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Raw files (collapsible) */}
      {client.filenames.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900 overflow-hidden">
          <button
            onClick={() => setRawFilesOpen((o) => !o)}
            className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-slate-800/40 text-left"
          >
            {rawFilesOpen ? (
              <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
            )}
            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-white">Raw files</span>
            <span className="text-[11px] text-slate-500 ml-auto">{client.filenames.length} synced</span>
          </button>
          {rawFilesOpen && (
            <div className="border-t border-slate-700/50 p-3 space-y-1">
              {client.filenames.map((fn) => (
                <div
                  key={fn}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-slate-800/40 text-xs"
                >
                  <span className="text-slate-200 truncate font-mono">{fn}</span>
                  <button
                    onClick={() => setBrowserOpen(true)}
                    className="text-amber-400 hover:text-amber-300 flex-shrink-0"
                  >
                    Inspect →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {browserOpen && client.filenames.length > 0 && (
        <FileBrowserModal slug={client.slug} filenames={client.filenames} onClose={() => setBrowserOpen(false)} />
      )}
      {shareOpen && (
        <ShareDialog slug={client.slug} open={shareOpen} onClose={() => setShareOpen(false)} />
      )}

      {weeklyReportOpen && (
        <WeeklyReportPanel
          slug={client.slug}
          open={weeklyReportOpen}
          onClose={() => setWeeklyReportOpen(false)}
        />
      )}


      {buildOpen && (
        <BuildModal
          loading={recLoading}
          error={recError}
          source={recSource}
          suggestions={suggestions}
          missingRoles={recMissingRoles}
          accepted={accepted}
          saving={savingSuggestions}
          fileCount={client.file_count}
          onPickHeuristic={() => recommend('heuristic')}
          onPickAI={() => recommend('ai')}
          onPickTemplate={(id) => recommend('template', id)}
          onToggle={toggleAccept}
          onSelectAll={() => suggestions && setAccepted(new Set(suggestions.map((_, i) => i)))}
          onSave={saveAccepted}
          onClose={() => {
            setBuildOpen(false)
            setSuggestions(null)
          }}
        />
      )}
    </div>
  )
}

/* ───────────────────────────── Sub-components ───────────────────────────── */

function FilesToggle({
  filenames,
  selectedFiles,
  onChange,
  onToggle,
}: {
  filenames: string[]
  selectedFiles: Set<string>
  onChange: (s: Set<string>) => void
  onToggle: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selectedFiles.size === filenames.length
  return (
    <div className="relative inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <FilterIcon className="h-3.5 w-3.5" /> Files:
      </span>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
      >
        {selectedFiles.size}/{filenames.length} selected
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 top-full mt-1 w-72 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => onChange(new Set(filenames))}
                disabled={allSelected}
                className="text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                Select all
              </button>
              <button
                onClick={() => onChange(new Set())}
                disabled={selectedFiles.size === 0}
                className="text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filenames.map((fn) => (
                <label
                  key={fn}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-800/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(fn)}
                    onChange={() => onToggle(fn)}
                  />
                  <span className="text-slate-200 truncate">{fn}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyKPIs({
  fileCount,
  onBuild,
  onSync,
  syncing,
  driveConnected,
}: {
  fileCount: number
  onBuild: () => void
  onSync: () => void
  syncing: boolean
  driveConnected: boolean
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
      <BarChart3 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
      {fileCount === 0 ? (
        <>
          <h3 className="text-base font-semibold text-white">No data synced yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            {driveConnected
              ? 'Click Sync to pull files from this client\'s Drive folder.'
              : 'Connect this client\'s Drive folder first, then sync.'}
          </p>
          <button
            onClick={onSync}
            disabled={!driveConnected || syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-white">No KPIs yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            Build a starter dashboard from your synced files.
          </p>
          <button
            onClick={onBuild}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20"
          >
            <Wand2 className="h-4 w-4" /> Build a dashboard
          </button>
        </>
      )}
    </div>
  )
}

function FileBrowserModal({
  slug,
  filenames,
  onClose,
}: {
  slug: string
  filenames: string[]
  onClose: () => void
}) {
  // Reuse FileBrowser but auto-open by simulating its trigger
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-400" /> Browse data
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <FileBrowserInner slug={slug} filenames={filenames} />
        </div>
      </div>
    </div>
  )
}

interface InspectColumn {
  name: string
  type: 'number' | 'date' | 'boolean' | 'text'
  distinct_count: number
  empty_count: number
  top_values: { value: string; count: number }[]
}

interface InspectResult {
  filename: string
  row_count: number
  columns: InspectColumn[]
  sample_rows: Record<string, string>[]
}

function FileBrowserInner({ slug, filenames }: { slug: string; filenames: string[] }) {
  const [active, setActive] = useState<string | null>(filenames[0] ?? null)
  const [data, setData] = useState<InspectResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'columns' | 'rows'>('columns')

  useEffect(() => {
    if (!active) return
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/reporting/${slug}/files/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: active }),
    })
      .then(async (r) => {
        const b = await r.json()
        if (!r.ok) throw new Error(b.error || 'Inspect failed')
        setData(b)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Inspect failed'))
      .finally(() => setLoading(false))
  }, [active, slug])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {filenames.map((fn) => (
          <button
            key={fn}
            onClick={() => setActive(fn)}
            className={
              active === fn
                ? 'px-3 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'px-3 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }
          >
            {fn}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {(['columns', 'rows'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'px-3 py-1 text-xs rounded-md bg-slate-800 text-slate-200 border border-slate-700'
                : 'px-3 py-1 text-xs rounded-md text-slate-500 hover:text-slate-300'
            }
          >
            {t === 'columns' ? 'Columns + values' : 'Sample rows'}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-[11px] text-slate-500">
            {data.row_count.toLocaleString()} rows · {data.columns.length} columns
          </span>
        )}
      </div>
      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !error && data && tab === 'columns' && (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {data.columns.map((c) => (
            <details key={c.name} className="rounded-lg border border-slate-700/60 bg-slate-950/40">
              <summary className="cursor-pointer px-3 py-2 flex items-center gap-2 hover:bg-slate-800/40">
                <span className="text-sm text-slate-200 font-mono flex-1 truncate">{c.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{c.type}</span>
                <span className="text-[10px] text-slate-500">{c.distinct_count} distinct</span>
                {c.empty_count > 0 && (
                  <span className="text-[10px] text-amber-400">{c.empty_count} empty</span>
                )}
              </summary>
              <div className="px-3 pb-3">
                {c.top_values.length === 0 ? (
                  <p className="text-xs text-slate-500">No values.</p>
                ) : (
                  <table className="w-full text-xs">
                    <tbody>
                      {c.top_values.map((v) => (
                        <tr key={v.value} className="border-t border-slate-800">
                          <td className="py-1 pr-2 text-slate-300 truncate">{v.value}</td>
                          <td className="py-1 text-right text-slate-500 font-mono">{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
      {!loading && !error && data && tab === 'rows' && (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/40 sticky top-0">
              <tr>
                {data.columns.map((c) => (
                  <th key={c.name} className="px-2 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sample_rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-800">
                  {data.columns.map((c) => (
                    <td key={c.name} className="px-2 py-1 text-slate-300 whitespace-nowrap max-w-[240px] truncate">
                      {String(row[c.name] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface TemplateMeta {
  id: string
  name: string
  description: string
  industry: string
  kpi_count: number
}

function BuildModal({
  loading,
  error,
  source,
  suggestions,
  missingRoles,
  accepted,
  saving,
  fileCount,
  onPickHeuristic,
  onPickAI,
  onPickTemplate,
  onToggle,
  onSelectAll,
  onSave,
  onClose,
}: {
  loading: boolean
  error: string | null
  source: 'heuristic' | 'ai' | 'template'
  suggestions: AISuggestion[] | null
  missingRoles: string[]
  accepted: Set<number>
  saving: boolean
  fileCount: number
  onPickHeuristic: () => void
  onPickAI: () => void
  onPickTemplate: (id: string) => void
  onToggle: (i: number) => void
  onSelectAll: () => void
  onSave: () => void
  onClose: () => void
}) {
  // Static template metadata — kept in sync with lib/reporting/templates.ts
  const templates: TemplateMeta[] = [
    {
      id: 'marketing_webinar',
      name: 'Marketing Webinar',
      description:
        '5 webinar funnel KPIs: registrations · show-up rate · conversion · cost per reg · ROAS',
      industry: 'marketing_webinar',
      kpi_count: 5,
    },
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-amber-400" /> Build a dashboard
          </h2>
          <button onClick={() => !saving && onClose()} className="p-1 rounded hover:bg-slate-800 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!suggestions && !loading && (
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Templates</p>
              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onPickTemplate(t.id)}
                    disabled={fileCount === 0}
                    className="w-full text-left p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-white inline-flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-emerald-300" /> {t.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-emerald-400">
                        {t.kpi_count} KPIs · free
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{t.description}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Auto-resolves data sources from your synced files.
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Generic builders</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={onPickHeuristic}
                  disabled={fileCount === 0}
                  className="text-left p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wand2 className="h-4 w-4 text-amber-300" />
                    <span className="text-sm font-semibold text-white">Heuristic (free)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Pattern-matches column names + types. Instant. No tokens.
                  </p>
                </button>
                <button
                  onClick={onPickAI}
                  disabled={fileCount === 0}
                  className="text-left p-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-indigo-300" />
                    <span className="text-sm font-semibold text-white">AI polish</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Claude reads samples + adds cross-file reasoning. ~$0.20/call.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 p-6 inline-flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {source === 'ai'
              ? 'Reading your files and reasoning through useful KPIs…'
              : 'Inferring KPIs from column names + types…'}
          </div>
        )}

        {error && (
          <div className="p-4 m-4 rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {suggestions && suggestions.length === 0 && !loading && (
          <div className="p-6">
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-200 text-sm">
              <p className="font-semibold mb-1">Template couldn't generate any KPIs.</p>
              {missingRoles.length > 0 && (
                <p className="text-[12px]">
                  Missing data for: <span className="font-mono">{missingRoles.join(', ')}</span>. Sync files matching these roles, or use the Heuristic / AI builders below.
                </p>
              )}
            </div>
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {source === 'template' && missingRoles.length > 0 && (
                <div className="mb-3 p-2 rounded border border-amber-500/30 bg-amber-500/5 text-amber-200 text-[11px]">
                  Couldn't find data for: <span className="font-mono">{missingRoles.join(', ')}</span>. KPIs that depend on these were skipped. Sync the relevant files (e.g. ad spend, sales) and re-apply.
                </div>
              )}
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
                      onChange={() => onToggle(i)}
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
            </div>
            <div className="p-4 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {accepted.size} of {suggestions.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onSelectAll}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
                >
                  Select all
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || accepted.size === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving…' : `Save ${accepted.size} KPI${accepted.size === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FreshnessPill({ lastSynced }: { lastSynced: string }) {
  const ageMs = Date.now() - new Date(lastSynced).getTime()
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000))
  const hours = Math.floor(ageMs / (60 * 60 * 1000))
  let label = ''
  if (days >= 1) label = `${days}d old`
  else if (hours >= 1) label = `${hours}h old`
  else label = 'fresh'
  const stale = days >= 7
  const aging = days >= 1 && days < 7
  const cls = stale
    ? 'bg-red-500/10 border-red-500/30 text-red-300'
    : aging
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${cls}`}
      title={`Last sync: ${new Date(lastSynced).toLocaleString()}`}
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  )
}

function Pill({ ok, children, compact }: { ok: boolean; children: React.ReactNode; compact?: boolean }) {
  return (
    <span
      className={
        ok
          ? `inline-flex items-center gap-1 ${compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'} rounded-full text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300`
          : `inline-flex items-center gap-1 ${compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'} rounded-full text-[11px] bg-slate-800 border border-slate-700 text-slate-400`
      }
    >
      {ok && <Check className="h-3 w-3" />}
      {children}
    </span>
  )
}
