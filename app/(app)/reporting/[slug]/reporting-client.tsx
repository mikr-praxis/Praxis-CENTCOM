'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, RefreshCw, Settings2, FolderInput, Sparkles } from 'lucide-react'
import { TimeframePicker, computeTimeframe, type TimeframeValue } from '@/components/reporting/TimeframePicker'
import { KPICardGrid } from '@/components/reporting/KPICardGrid'
import type { KPIResult } from '@/lib/reporting/types'

interface RawFileSummary {
  id: string
  drive_file_id: string
  filename: string
  mime_type: string | null
  modified_time: string | null
  last_synced_at: string | null
  row_count: number
  columns: string[]
}

interface ClientInfo {
  id: string
  slug: string
  name: string
  drive_folder_id: string | null
}

interface Props {
  client: ClientInfo
  rawFiles: RawFileSummary[]
  readOnly: boolean
}

export function ReportingClient({ client, rawFiles, readOnly }: Props) {
  const [folderId, setFolderId] = useState(client.drive_folder_id ?? '')
  const [savingFolder, setSavingFolder] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [folderSaved, setFolderSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncingNow, setSyncingNow] = useState(false)
  const [syncSummary, setSyncSummary] = useState<string | null>(null)

  // Timeframe + KPI state
  const [timeframe, setTimeframe] = useState<TimeframeValue>(() => computeTimeframe('30d', null, null))
  const [kpiResults, setKpiResults] = useState<KPIResult[]>([])
  const [kpiCount, setKpiCount] = useState(0)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [seedingKpis, setSeedingKpis] = useState(false)

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true)
    try {
      const params = new URLSearchParams()
      if (timeframe.start) params.set('start', timeframe.start)
      if (timeframe.end) params.set('end', timeframe.end)
      const res = await fetch(`/api/reporting/${client.slug}/kpis?${params.toString()}`)
      if (!res.ok) {
        setKpiResults([])
        setKpiCount(0)
      } else {
        const body = await res.json()
        setKpiResults(body.results ?? [])
        setKpiCount(body.kpi_count ?? 0)
      }
    } catch {
      setKpiResults([])
      setKpiCount(0)
    } finally {
      setKpisLoading(false)
    }
  }, [client.slug, timeframe.start, timeframe.end])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  async function saveFolder() {
    setSavingFolder(true)
    setFolderError(null)
    setFolderSaved(false)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_folder_id: folderId.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (${res.status})`)
      }
      setFolderSaved(true)
      setTimeout(() => setFolderSaved(false), 2500)
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingFolder(false)
    }
  }

  async function listFolderTest() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/folder/list`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Drive list failed (${res.status})`)
      }
      const body = await res.json()
      alert(
        body.files?.length
          ? `Drive folder OK. Found ${body.files.length} files:\n\n` +
              body.files.map((f: { name: string; mimeType: string }) => `• ${f.name} (${f.mimeType})`).join('\n')
          : 'Drive folder OK but it has no files yet.'
      )
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Drive list failed')
    } finally {
      setSyncing(false)
    }
  }

  async function syncNow() {
    setSyncingNow(true)
    setSyncError(null)
    setSyncSummary(null)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/sync`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Sync failed (${res.status})`)
      const r = body.result || {}
      setSyncSummary(
        `Sync done. Seen ${r.files_seen ?? 0}, synced ${r.files_synced ?? 0}, skipped ${r.files_skipped ?? 0}, unsupported ${r.files_unsupported ?? 0}.`
      )
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncingNow(false)
    }
  }

  async function seedKpis() {
    setSeedingKpis(true)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/kpis/seed`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Seed failed (${res.status})`)
      await fetchKpis()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Seed failed')
    } finally {
      setSeedingKpis(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      {!readOnly && (
        <Link
          href="/reporting"
          className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200 mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Reporting
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <p className="text-slate-400 text-sm mt-1">Client report</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!client.drive_folder_id || syncing}
              onClick={listFolderTest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Checking...' : 'Test Drive'}
            </button>
            <button
              disabled={!client.drive_folder_id || syncingNow}
              onClick={syncNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncingNow ? 'animate-spin' : ''}`} />
              {syncingNow ? 'Syncing...' : 'Sync Now'}
            </button>
            <Link
              href={`/reporting/${client.slug}/configure`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Settings2 className="h-4 w-4" />
              Configure KPIs
            </Link>
          </div>
        )}
      </div>

      {/* Timeframe picker */}
      <div className="mb-4">
        <TimeframePicker value={timeframe} onChange={setTimeframe} />
      </div>

      {/* Drive folder configuration */}
      {!readOnly && (
        <div className="mb-6 p-4 rounded-xl border border-slate-700/50 bg-slate-900">
          <div className="flex items-center gap-2 mb-2">
            <FolderInput className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Drive folder</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Paste the folder ID for <span className="font-mono text-slate-300">{client.name}</span> from your{' '}
            <span className="font-mono text-slate-300">Client Raw Data for AI</span> Drive folder. The folder ID
            is the segment after <span className="font-mono text-slate-300">/folders/</span> in the URL.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="1AbCdEf… (Drive folder ID)"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={saveFolder}
              disabled={savingFolder}
              className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
            >
              {savingFolder ? 'Saving...' : 'Save'}
            </button>
          </div>
          {folderError && <p className="text-red-400 text-xs mt-2">{folderError}</p>}
          {folderSaved && <p className="text-emerald-400 text-xs mt-2">Saved.</p>}
          {syncError && <p className="text-red-400 text-xs mt-2">{syncError}</p>}
          {syncSummary && <p className="text-emerald-400 text-xs mt-2">{syncSummary}</p>}
        </div>
      )}

      {/* KPI cards */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">KPIs</h2>
          {!readOnly && kpiCount === 0 && rawFiles.length > 0 && !kpisLoading && (
            <button
              onClick={seedKpis}
              disabled={seedingKpis}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {seedingKpis ? 'Seeding...' : 'Seed example KPIs'}
            </button>
          )}
        </div>
        {kpiCount === 0 && !kpisLoading ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/30">
            <p className="text-slate-400 text-sm">
              {rawFiles.length === 0
                ? 'No KPIs yet. Sync data first, then add KPIs in the configurator (M4) or seed examples.'
                : 'No KPIs configured for this client. Click "Seed example KPIs" to start, or add custom ones in the configurator (M4).'}
            </p>
          </div>
        ) : (
          <KPICardGrid results={kpiResults} loading={kpisLoading} />
        )}
      </section>

      {/* Raw files table */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Raw files</h2>
          <span className="text-xs text-slate-500">{rawFiles.length} synced</span>
        </div>
        {rawFiles.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">
            No files synced yet. Connect the Drive folder above and the weekly sync will populate this section.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Filename</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Rows</th>
                <th className="px-4 py-2 font-medium">Columns</th>
                <th className="px-4 py-2 font-medium">Modified</th>
                <th className="px-4 py-2 font-medium">Synced</th>
              </tr>
            </thead>
            <tbody>
              {rawFiles.map((f) => (
                <tr key={f.id} className="border-t border-slate-800">
                  <td className="px-4 py-2 text-slate-200">{f.filename}</td>
                  <td className="px-4 py-2 text-slate-400">{shortMime(f.mime_type)}</td>
                  <td className="px-4 py-2 text-slate-300">{f.row_count}</td>
                  <td className="px-4 py-2 text-slate-400">{f.columns.length}</td>
                  <td className="px-4 py-2 text-slate-400">
                    {f.modified_time ? new Date(f.modified_time).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-400">
                    {f.last_synced_at ? new Date(f.last_synced_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function shortMime(mt: string | null): string {
  if (!mt) return '—'
  if (mt === 'text/csv' || mt === 'application/csv') return 'CSV'
  if (mt === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet'
  if (mt === 'application/vnd.google-apps.document') return 'Google Doc'
  if (mt === 'text/plain') return 'Text'
  return mt.split('/').pop() || mt
}
