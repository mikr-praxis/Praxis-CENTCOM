'use client'

import { useState } from 'react'
import { Upload, FileSpreadsheet, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { KPICard } from '@/components/dashboard/client/KPICard'
import { FunnelViz } from '@/components/dashboard/client/FunnelViz'
import { ClientTrendChart } from '@/components/dashboard/client/ClientTrendChart'
import { DataQualityBanner } from '@/components/dashboard/client/DataQualityBanner'
import { MappingReviewUI } from '@/components/dashboard/client/MappingReviewUI'
import type { FunnelType, CanonicalMetric, MetricSnapshot, DataSource, MapperResult, SheetTabData } from '@/lib/metrics/types'

interface ClientDashboardProps {
  client: {
    id: string
    slug: string
    name: string
    funnel_type: FunnelType
    funnel_config: Record<string, unknown>
  }
  snapshots: MetricSnapshot[]
  dataSources: DataSource[]
  events: Array<{ event_name: string; event_date: string; event_type: string | null }>
  metrics: CanonicalMetric[]
  stages: Array<{ label: string; metricKey: string }>
  benchmarks: Record<string, { weak: number; strong: number }>
  kpiKeys: string[]
}

type View = 'dashboard' | 'ingest-sheet' | 'ingest-csv' | 'mapping-review'

export function ClientDashboard({
  client,
  snapshots,
  dataSources,
  metrics,
  stages,
  benchmarks,
  kpiKeys,
}: ClientDashboardProps) {
  const [view, setView] = useState<View>('dashboard')
  const [sheetUrl, setSheetUrl] = useState('')
  const [csvData, setCsvData] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mappingData, setMappingData] = useState<{
    dataSourceId: string
    mapping: MapperResultType
    sheetData: SheetDataType[]
  } | null>(null)

  // Most recent value per metric
  const latestByMetric = new Map<string, { value: number; confidence: string }>()
  const trendByMetric = new Map<string, Array<{ date: string; value: number; confidence: string }>>()

  for (const snap of snapshots) {
    if (snap.metric_value === null) continue
    // Build trend data
    if (!trendByMetric.has(snap.metric_key)) {
      trendByMetric.set(snap.metric_key, [])
    }
    trendByMetric.get(snap.metric_key)!.push({
      date: snap.period_date,
      value: snap.metric_value,
      confidence: snap.confidence,
    })
    // Track latest
    latestByMetric.set(snap.metric_key, { value: snap.metric_value, confidence: snap.confidence })
  }

  // Calculate deltas (current vs prior period)
  function getDelta(metricKey: string): number | undefined {
    const trend = trendByMetric.get(metricKey)
    if (!trend || trend.length < 2) return undefined
    const current = trend[trend.length - 1].value
    const prior = trend[trend.length - 2].value
    if (prior === 0) return undefined
    return (current - prior) / prior
  }

  // Build funnel stage values from latest snapshots
  const funnelStages = stages.map(s => ({
    ...s,
    value: latestByMetric.get(s.metricKey)?.value || 0,
  }))

  // Determine data quality
  const presentMetrics = new Set(latestByMetric.keys())
  const missingMetrics = metrics
    .filter(m => !m.is_derived && !presentMetrics.has(m.key))
    .map(m => m.key)
  const derivedMetrics = metrics
    .filter(m => m.is_derived && presentMetrics.has(m.key))
    .map(m => ({ key: m.key, formula: m.formula || '' }))
  const estimatedMetrics = [...latestByMetric.entries()]
    .filter(([, v]) => v.confidence === 'estimated')
    .map(([k]) => k)

  const hasData = snapshots.length > 0

  async function handleIngest(type: 'sheet' | 'csv') {
    setLoading(true)
    setError(null)
    try {
      const endpoint = type === 'sheet' ? '/api/ingest/sheets' : '/api/ingest/csv'
      const payload = type === 'sheet'
        ? { sheetUrl, clientSlug: client.slug }
        : { csvData, clientSlug: client.slug }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ingestion failed')
      }

      const result = await res.json()
      setMappingData({
        dataSourceId: result.dataSourceId,
        mapping: result.mapping,
        sheetData: result.sheetData,
      })
      setView('mapping-review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (view === 'mapping-review' && mappingData) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>
        <MappingReviewUI
          clientSlug={client.slug}
          clientName={client.name}
          funnelType={client.funnel_type}
          dataSourceId={mappingData.dataSourceId}
          mapping={mappingData.mapping}
          sheetData={mappingData.sheetData}
          onApproved={() => {
            setView('dashboard')
            window.location.reload()
          }}
        />
      </div>
    )
  }

  if (view === 'ingest-sheet') {
    return (
      <div className="space-y-6 max-w-lg">
        <button
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-xl font-bold text-slate-100">Connect Google Sheet</h2>
        <p className="text-sm text-slate-400">
          Paste the Sheet URL. The sheet must be shared with the service account as Viewer.
        </p>
        <input
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl}
          onChange={e => setSheetUrl(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={() => handleIngest('sheet')}
          disabled={loading || !sheetUrl}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Reading sheet...' : 'Read & Map'}
        </button>
      </div>
    )
  }

  if (view === 'ingest-csv') {
    return (
      <div className="space-y-6 max-w-lg">
        <button
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-xl font-bold text-slate-100">Paste CSV Data</h2>
        <p className="text-sm text-slate-400">
          Paste raw CSV data including headers.
        </p>
        <textarea
          placeholder="Date, Leads, Calls Booked, Shows, Closes, Cash..."
          value={csvData}
          onChange={e => setCsvData(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-slate-200 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={() => handleIngest('csv')}
          disabled={loading || !csvData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Parsing & mapping...' : 'Parse & Map'}
        </button>
      </div>
    )
  }

  // Main dashboard view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{client.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {client.funnel_type} funnel
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('ingest-sheet')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-slate-300 text-sm hover:border-zinc-600 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" /> Connect Sheet
          </button>
          <button
            onClick={() => setView('ingest-csv')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-slate-300 text-sm hover:border-zinc-600 transition-colors"
          >
            <Upload className="h-4 w-4" /> Upload CSV
          </button>
        </div>
      </div>

      {!hasData ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-64 bg-zinc-900 rounded-xl border border-zinc-800">
          <FileSpreadsheet className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-slate-400 mb-1">No performance data yet</p>
          <p className="text-xs text-slate-500 mb-4">Connect a Google Sheet or paste CSV data to get started.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setView('ingest-sheet')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors"
            >
              Connect Sheet
            </button>
            <button
              onClick={() => setView('ingest-csv')}
              className="px-3 py-1.5 rounded-lg bg-zinc-700 text-slate-300 text-sm hover:bg-zinc-600 transition-colors"
            >
              Paste CSV
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiKeys.map(key => {
              const metric = metrics.find(m => m.key === key)
              const latest = latestByMetric.get(key)
              if (!metric || !latest) return null
              return (
                <KPICard
                  key={key}
                  label={metric.display_name}
                  value={latest.value}
                  format={metric.type}
                  delta={getDelta(key)}
                  benchmark={benchmarks[key]}
                  confidence={latest.confidence as 'direct' | 'derived' | 'estimated'}
                />
              )
            })}
          </div>

          {/* Funnel */}
          <FunnelViz stages={funnelStages} />

          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {['cash_collected', 'leads', 'closes', 'show_rate'].map(key => {
              const metric = metrics.find(m => m.key === key)
              const trend = trendByMetric.get(key)
              if (!metric || !trend) return null
              return (
                <ClientTrendChart
                  key={key}
                  metricKey={key}
                  label={metric.display_name}
                  data={trend}
                  format={metric.type}
                  benchmark={benchmarks[key]?.strong}
                />
              )
            })}
          </div>

          {/* Data Quality */}
          <DataQualityBanner
            missingMetrics={missingMetrics}
            derivedMetrics={derivedMetrics}
            estimatedMetrics={estimatedMetrics}
          />
        </>
      )}

      {/* Data Sources */}
      {dataSources.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Data Sources</h3>
          {dataSources.map((ds: DataSource) => (
            <div key={ds.id} className="flex items-center justify-between text-xs text-slate-400">
              <span>{ds.source_type === 'google_sheet' ? 'Sheet' : 'CSV'}{ds.source_url ? ` · ${ds.source_url.slice(0, 60)}...` : ''}</span>
              <span className={`px-2 py-0.5 rounded ${
                ds.mapping_status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                ds.mapping_status === 'active' ? 'bg-blue-500/10 text-blue-400' :
                'bg-amber-400/10 text-amber-400'
              }`}>
                {ds.mapping_status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type MapperResultType = MapperResult
type SheetDataType = SheetTabData & { allRows?: string[][] }
