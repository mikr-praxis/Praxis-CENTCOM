'use client'

/**
 * Studio Builder — ad-hoc visual report builder beneath the KPI grid.
 *
 * Four dropdowns:
 *   - Source        (one Drive file or one provider's facts)
 *   - Measure       (a numeric field on that source, or "Row count")
 *   - Dimension     (a date or category field on that source)
 *   - Chart type    (line / bar / pie / table)
 *
 * Hits /api/reporting/[slug]/fields once to populate the dropdowns, then
 * /api/reporting/[slug]/explore on every change to re-render the chart.
 *
 * v1: intra-source only. The unified picker is here in spirit — every
 * source is listed in one dropdown — but you must pick measure + dimension
 * from the SAME source. A short note explains this.
 *
 * Saving reports + filters land in v2.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Skeleton } from '@/components/ui/Skeleton'

interface FieldDef {
  name: string
  type: 'date' | 'number' | 'category'
}
interface SourceCatalog {
  id: string
  label: string
  kind: 'drive' | 'external'
  row_count: number
  fields: FieldDef[]
}
interface FieldsResp {
  sources: SourceCatalog[]
}
interface ChartPoint {
  bucket: string
  value: number | null
}
interface ExploreResp {
  chart_type: 'line' | 'bar' | 'pie' | 'table'
  points: ChartPoint[]
  rows_used: number
  is_date_dimension: boolean
  granularity: 'day' | 'week' | 'month' | null
}

type ChartType = 'line' | 'bar' | 'pie' | 'table'
type MeasureOp = 'sum' | 'count' | 'avg' | 'min' | 'max'

const PIE_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
]

interface Props {
  slug: string
  timeframe?: { start: string | null; end: string | null }
}

export function StudioBuilder({ slug, timeframe }: Props) {
  const [catalog, setCatalog] = useState<SourceCatalog[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const [sourceId, setSourceId] = useState<string>('')
  const [measureColumn, setMeasureColumn] = useState<string>('')
  const [measureOp, setMeasureOp] = useState<MeasureOp>('sum')
  const [dimensionColumn, setDimensionColumn] = useState<string>('')
  const [chartType, setChartType] = useState<ChartType>('line')

  const [result, setResult] = useState<ExploreResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the field catalog once on mount.
  useEffect(() => {
    let cancel = false
    fetch(`/api/reporting/${slug}/fields`)
      .then(async (r) => {
        const b = await r.json()
        if (!r.ok) throw new Error(b.error || 'Failed to load fields')
        return b as FieldsResp
      })
      .then((b) => {
        if (cancel) return
        setCatalog(b.sources)
        // Auto-pick first source with at least one number + one date/category field.
        const first = b.sources.find(
          (s) => s.fields.some((f) => f.type === 'number') && s.fields.length >= 2
        ) ?? b.sources[0]
        if (first) {
          setSourceId(first.id)
        }
      })
      .catch((e) => {
        if (!cancel) setCatalogError(e instanceof Error ? e.message : 'Failed to load fields')
      })
    return () => { cancel = true }
  }, [slug])

  const selectedSource = useMemo(
    () => catalog?.find((s) => s.id === sourceId) ?? null,
    [catalog, sourceId]
  )

  // When source changes, set sensible defaults for measure + dimension.
  useEffect(() => {
    if (!selectedSource) return
    const dateField = selectedSource.fields.find((f) => f.type === 'date')
    const numberField = selectedSource.fields.find((f) => f.type === 'number')
    const catField = selectedSource.fields.find((f) => f.type === 'category')
    if (numberField) {
      setMeasureColumn(numberField.name)
      setMeasureOp('sum')
    } else {
      setMeasureColumn('')
      setMeasureOp('count')
    }
    setDimensionColumn(dateField?.name ?? catField?.name ?? selectedSource.fields[0]?.name ?? '')
  }, [selectedSource])

  const measureFields = useMemo(
    () => selectedSource?.fields.filter((f) => f.type === 'number') ?? [],
    [selectedSource]
  )
  const dimensionFields = useMemo(
    () => selectedSource?.fields.filter((f) => f.type === 'date' || f.type === 'category') ?? [],
    [selectedSource]
  )

  // Re-fetch chart data whenever any input changes.
  useEffect(() => {
    if (!sourceId || !dimensionColumn) return
    if (measureOp !== 'count' && !measureColumn) return
    let cancel = false
    setLoading(true)
    setError(null)
    const body = {
      source_id: sourceId,
      measure_column: measureOp === 'count' ? '' : measureColumn,
      measure_op: measureOp,
      dimension_column: dimensionColumn,
      chart_type: chartType,
      timeframe: timeframe ?? null,
      limit: 50,
    }
    fetch(`/api/reporting/${slug}/explore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const b = await r.json()
        if (!r.ok) throw new Error(b.error || 'Explore failed')
        return b as ExploreResp
      })
      .then((b) => {
        if (!cancel) setResult(b)
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Explore failed')
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => { cancel = true }
  }, [slug, sourceId, measureColumn, measureOp, dimensionColumn, chartType, timeframe?.start, timeframe?.end])

  if (catalogError) {
    return (
      <section className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4">
        <h2 className="text-sm font-semibold text-white">Studio Builder</h2>
        <p className="mt-2 text-xs text-red-300">{catalogError}</p>
      </section>
    )
  }

  if (!catalog) {
    return (
      <section className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Studio Builder</h2>
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </section>
    )
  }

  if (catalog.length === 0) {
    return (
      <section className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4">
        <h2 className="text-sm font-semibold text-white">Studio Builder</h2>
        <p className="mt-2 text-xs text-slate-400">
          No data sources yet. Sync a Drive folder or configure an integration (Stripe, PostHog, HubSpot, Meta Ads, Google Ads) and the builder will pick them up.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Studio Builder</h2>
          <p className="text-[11px] text-slate-500">
            Ad-hoc exploration across {catalog.length} source{catalog.length === 1 ? '' : 's'}. Saved reports + cross-source joins coming next.
          </p>
        </div>
        {result && (
          <span className="text-[11px] text-slate-500 font-mono">
            {result.rows_used.toLocaleString()} rows
            {result.granularity ? ` · ${result.granularity}` : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Source */}
        <Dropdown label="Source" value={sourceId} onChange={setSourceId}>
          <optgroup label="Drive files">
            {catalog.filter((s) => s.kind === 'drive').map((s) => (
              <option key={s.id} value={s.id}>{s.label} ({s.row_count.toLocaleString()} rows)</option>
            ))}
          </optgroup>
          <optgroup label="Integrations">
            {catalog.filter((s) => s.kind === 'external').map((s) => (
              <option key={s.id} value={s.id}>{s.label} ({s.row_count.toLocaleString()} rows)</option>
            ))}
          </optgroup>
        </Dropdown>

        {/* Measure */}
        <Dropdown
          label="Measure"
          value={measureOp === 'count' ? '__count__' : measureColumn}
          onChange={(v) => {
            if (v === '__count__') { setMeasureOp('count'); setMeasureColumn('') }
            else { setMeasureOp('sum'); setMeasureColumn(v) }
          }}
        >
          <option value="__count__">Row count</option>
          {measureFields.length > 0 && (
            <optgroup label="Sum of">
              {measureFields.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </optgroup>
          )}
        </Dropdown>

        {/* Dimension */}
        <Dropdown label="Dimension" value={dimensionColumn} onChange={setDimensionColumn}>
          {dimensionFields.length === 0 ? (
            <option value="">No dimensions available</option>
          ) : (
            dimensionFields.map((f) => (
              <option key={f.name} value={f.name}>{f.name} ({f.type})</option>
            ))
          )}
        </Dropdown>

        {/* Chart type */}
        <Dropdown label="Chart" value={chartType} onChange={(v) => setChartType(v as ChartType)}>
          <option value="line">Line</option>
          <option value="bar">Bar</option>
          <option value="pie">Pie</option>
          <option value="table">Table</option>
        </Dropdown>
      </div>

      <div className="min-h-[280px] rounded-lg border border-slate-700/40 bg-slate-950/30 p-3">
        {loading && <Skeleton className="h-64 w-full" />}
        {error && <p className="text-xs text-red-300">{error}</p>}
        {!loading && !error && result && (
          <ChartRender result={result} measureOp={measureOp} measureColumn={measureColumn} />
        )}
      </div>
    </section>
  )
}

function Dropdown({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white"
      >
        {children}
      </select>
    </div>
  )
}

function ChartRender({
  result,
  measureOp,
  measureColumn,
}: {
  result: ExploreResp
  measureOp: MeasureOp
  measureColumn: string
}) {
  if (result.points.length === 0) {
    return <p className="text-xs text-slate-400">No matching rows.</p>
  }

  const measureLabel =
    measureOp === 'count' ? 'Row count' : `${measureOp[0].toUpperCase()}${measureOp.slice(1)} ${measureColumn}`

  if (result.chart_type === 'table') {
    return (
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/40 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left text-slate-400">Bucket</th>
              <th className="px-2 py-1.5 text-right text-slate-400">{measureLabel}</th>
            </tr>
          </thead>
          <tbody>
            {result.points.map((p) => (
              <tr key={p.bucket} className="border-t border-slate-800">
                <td className="px-2 py-1 text-slate-300">{p.bucket}</td>
                <td className="px-2 py-1 text-right text-slate-200 font-mono">
                  {p.value == null ? '—' : p.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (result.chart_type === 'pie') {
    const data = result.points.map((p) => ({ name: p.bucket, value: p.value ?? 0 }))
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={100}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const ChartCmp = result.chart_type === 'bar' ? BarChart : LineChart
  const SeriesCmp = result.chart_type === 'bar' ? Bar : Line

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ChartCmp data={result.points}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="bucket" stroke="#64748b" tick={{ fontSize: 11 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
        {result.chart_type === 'bar' ? (
          <Bar dataKey="value" fill="#f59e0b" />
        ) : (
          <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
        )}
      </ChartCmp>
    </ResponsiveContainer>
  )
}
