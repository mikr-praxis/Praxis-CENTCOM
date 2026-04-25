'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Save, Activity } from 'lucide-react'
import type { AggOp, Formula, Filter, CompositeOp, ConstOp } from '@/lib/reporting/types'
import { formatKPIValue } from '@/lib/reporting/engine'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'
import { AIKPIBuilder, type AIDraft } from '@/components/reporting/AIKPIBuilder'
import { FileBrowser } from '@/components/reporting/FileBrowser'

interface FileColumns {
  filename: string
  columns: string[]
}

interface KPIRow {
  id: string
  client_id: string | null
  key: string
  display_name: string
  description: string | null
  formula: Formula
  format: KPIFormat
  target: number | null
  viz_type: KPIVizType
  display_order: number
  group_by_column?: string | null
  group_by_source?: string | null
  compare_to?: 'previous_period' | 'previous_year' | null
  forecast_periods?: number
  forecast_method?: 'linear' | 'moving_avg' | null
}

interface Props {
  client: { id: string; slug: string; name: string }
  kpis: KPIRow[]
  files: FileColumns[]
  /** Default forecast method for new KPIs (from REPORTING_FORECAST_DEFAULT_METHOD). */
  forecastDefaultMethod?: 'linear' | 'moving_avg'
  /** Default forecast period count for new KPIs (from REPORTING_FORECAST_DEFAULT_PERIODS). */
  forecastDefaultPeriods?: number
}

const FORMAT_OPTIONS: KPIFormat[] = ['count', 'currency', 'percent', 'ratio']
const VIZ_OPTIONS: KPIVizType[] = ['card', 'line', 'bar', 'pie', 'table']
const AGG_OPS: AggOp['op'][] = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max']
const COMPOSITE_OPS: CompositeOp['op'][] = ['divide', 'multiply', 'add', 'subtract']
const FILTER_OPS: Filter['op'][] = ['eq', 'neq', 'in', 'not_in', 'contains', 'gt', 'gte', 'lt', 'lte', 'not_empty', 'empty']

type FormulaKind = 'agg' | 'composite' | 'const'

function emptyAgg(filename: string): AggOp {
  return { op: 'count', source: filename, filters: [] }
}

function emptyComposite(filename: string): CompositeOp {
  return {
    op: 'divide',
    numerator: emptyAgg(filename),
    denominator: emptyAgg(filename),
  }
}

function emptyConst(): ConstOp {
  return { op: 'const', value: 1 }
}

function detectKind(f: Formula): FormulaKind {
  if (['divide', 'multiply', 'add', 'subtract'].includes((f as CompositeOp).op)) return 'composite'
  if ((f as ConstOp).op === 'const') return 'const'
  return 'agg'
}

function emptyKPI(
  filename: string,
  forecastPeriods: number = 0,
  forecastMethod: 'linear' | 'moving_avg' | null = null
): Omit<KPIRow, 'id' | 'client_id'> {
  return {
    key: '',
    display_name: '',
    description: null,
    formula: emptyAgg(filename),
    format: 'count',
    target: null,
    viz_type: 'card',
    display_order: 0,
    group_by_column: null,
    group_by_source: null,
    compare_to: null,
    forecast_periods: forecastPeriods,
    forecast_method: forecastPeriods > 0 ? forecastMethod ?? 'linear' : null,
  }
}

/** Render a formula as a readable, plain-English-ish string. */
function formulaSummary(f: Formula): string {
  const kind = detectKind(f)
  if (kind === 'const') return String((f as ConstOp).value)
  if (kind === 'composite') {
    const c = f as CompositeOp
    if (c.op === 'divide') {
      return `(${formulaSummary(c.numerator || emptyConst())}) / (${formulaSummary(c.denominator || emptyConst())})`
    }
    const symbol = c.op === 'multiply' ? '×' : c.op === 'add' ? '+' : '−'
    return `(${formulaSummary(c.left || emptyConst())}) ${symbol} (${formulaSummary(c.right || emptyConst())})`
  }
  const a = f as AggOp
  let s = a.column ? `${a.op.toUpperCase()}(${a.column})` : `${a.op.toUpperCase()}(*)`
  s += ` from "${a.source}"`
  if (a.filters && a.filters.length > 0) {
    const parts = a.filters.map((flt) => {
      const v = Array.isArray(flt.value) ? flt.value.join('|') : flt.value
      if (flt.op === 'empty' || flt.op === 'not_empty') return `${flt.column} ${flt.op.replace('_', ' ')}`
      return `${flt.column} ${flt.op} ${v ?? ''}`
    })
    s += ` WHERE ${parts.join(' AND ')}`
  }
  if (a.timeframe_column) s += ` · TF:${a.timeframe_column}`
  return s
}

export function ConfigureClient({
  client,
  kpis: initialKpis,
  files,
  forecastDefaultMethod = 'linear',
  forecastDefaultPeriods = 0,
}: Props) {
  const [kpis, setKpis] = useState<KPIRow[]>(initialKpis)
  const [adding, setAdding] = useState(false)
  const defaultFile = files[0]?.filename ?? ''
  const [draft, setDraft] = useState<Omit<KPIRow, 'id' | 'client_id'>>(
    emptyKPI(defaultFile, forecastDefaultPeriods, forecastDefaultMethod)
  )
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function createKPI() {
    setError(null)
    if (!draft.key || !draft.display_name) {
      setError('Key and display name are required.')
      return
    }
    try {
      const res = await fetch(`/api/reporting/${client.slug}/kpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Create failed')
      setKpis((prev) => [...prev, body.kpi])
      setAdding(false)
      setDraft(emptyKPI(defaultFile, forecastDefaultPeriods, forecastDefaultMethod))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  async function saveKPI(kpi: KPIRow) {
    setSavingId(kpi.id)
    setError(null)
    try {
      const res = await fetch(`/api/reporting/${client.slug}/kpis/${kpi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kpi),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Save failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteKPI(id: string) {
    if (!confirm('Delete this KPI?')) return
    try {
      const res = await fetch(`/api/reporting/${client.slug}/kpis/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Delete failed')
      }
      setKpis((prev) => prev.filter((k) => k.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  function updateKpi(id: string, patch: Partial<KPIRow>) {
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)))
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
      <Link href={`/reporting/${client.slug}`} className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200 mb-4">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to {client.name} report
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configure KPIs — {client.name}</h1>
          <p className="text-slate-400 text-sm mt-1">Define metrics computed from synced raw files.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FileBrowser slug={client.slug} filenames={files.map((f) => f.filename)} />
          <AIKPIBuilder
            slug={client.slug}
            filenames={files.map((f) => f.filename)}
            onAccept={(d: AIDraft) => {
              setDraft({
                key: d.key,
                display_name: d.display_name,
                description: d.description,
                formula: d.formula,
                format: d.format,
                target: d.target,
                viz_type: d.viz_type,
                display_order: kpis.length,
              })
              setAdding(true)
            }}
          />
          <button
            onClick={() => setAdding(true)}
            disabled={adding || files.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add KPI
          </button>
        </div>
      </div>

      {files.length === 0 && (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <p className="text-amber-300 text-sm">
            No synced files yet. Sync the Drive folder first so you can pick source files for KPI formulas.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-sm">
          {error}
        </div>
      )}

      {adding && (
        <KPIEditor
          slug={client.slug}
          value={draft}
          files={files}
          onChange={(d) => setDraft(d as Omit<KPIRow, 'id' | 'client_id'>)}
          onCancel={() => {
            setAdding(false)
            setDraft(emptyKPI(defaultFile, forecastDefaultPeriods, forecastDefaultMethod))
          }}
          onSave={createKPI}
          isNew
        />
      )}

      <div className="space-y-3 mt-4">
        {kpis.length === 0 && !adding ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-slate-400 text-sm">
            No KPIs configured yet. Click "Add KPI" to create one.
          </div>
        ) : (
          kpis.map((kpi) => (
            <KPIEditor
              key={kpi.id}
              slug={client.slug}
              value={kpi}
              files={files}
              onChange={(patch) => updateKpi(kpi.id, patch as KPIRow)}
              onSave={() => saveKPI(kpi)}
              onDelete={() => deleteKPI(kpi.id)}
              saving={savingId === kpi.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface KPIEditorProps {
  slug: string
  value: Omit<KPIRow, 'id' | 'client_id'> & Partial<Pick<KPIRow, 'id' | 'client_id'>>
  files: FileColumns[]
  onChange: (patch: KPIRow | Omit<KPIRow, 'id' | 'client_id'>) => void
  onSave: () => void
  onCancel?: () => void
  onDelete?: () => void
  isNew?: boolean
  saving?: boolean
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50'

function KPIEditor({ slug, value, files, onChange, onSave, onCancel, onDelete, isNew, saving }: KPIEditorProps) {
  function setField<K extends keyof typeof value>(field: K, v: (typeof value)[K]) {
    onChange({ ...value, [field]: v } as KPIRow)
  }

  function setFormula(next: Formula) {
    onChange({ ...value, formula: next } as KPIRow)
  }

  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Field label="Display name">
          <input
            type="text"
            value={value.display_name}
            onChange={(e) => setField('display_name', e.target.value)}
            className={inputCls}
            placeholder="Total revenue"
          />
        </Field>
        <Field label="Key (slug)">
          <input
            type="text"
            value={value.key}
            onChange={(e) => setField('key', e.target.value)}
            className={inputCls}
            placeholder="total_revenue"
          />
        </Field>
        <Field label="Format">
          <select
            value={value.format}
            onChange={(e) => setField('format', e.target.value as KPIFormat)}
            className={inputCls}
          >
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Visualization">
          <select
            value={value.viz_type}
            onChange={(e) => setField('viz_type', e.target.value as KPIVizType)}
            className={inputCls}
          >
            {VIZ_OPTIONS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Target (optional)">
          <input
            type="number"
            value={value.target ?? ''}
            onChange={(e) => setField('target', e.target.value === '' ? null : Number(e.target.value))}
            className={inputCls}
            placeholder="e.g. 50000"
          />
        </Field>
        <Field label="Display order">
          <input
            type="number"
            value={value.display_order}
            onChange={(e) => setField('display_order', Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={value.description ?? ''}
          onChange={(e) => setField('description', e.target.value || null)}
          rows={2}
          className={inputCls}
          placeholder="What this KPI measures."
        />
      </Field>

      <div className="mt-4 p-3 rounded-lg border border-slate-700 bg-slate-950/40">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Formula</div>
        <FormulaEditor formula={value.formula} files={files} onChange={setFormula} />

        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Reads as</div>
          <p className="text-xs font-mono text-slate-400 break-all">{formulaSummary(value.formula)}</p>
        </div>

        <FormulaPreview slug={slug} formula={value.formula} format={value.format} viz={value.viz_type} />
      </div>

      <details className="mt-3 p-3 rounded-lg border border-slate-700 bg-slate-950/40">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500 hover:text-slate-300">
          Advanced — Group by, comparison, forecasting
        </summary>
        <AdvancedKPIOptions value={value} files={files} onChange={(patch) => onChange({ ...value, ...patch } as KPIRow)} />
      </details>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Top-level dispatcher. Lets the user switch the formula KIND (agg/composite/const). */
function FormulaEditor({
  formula,
  files,
  onChange,
}: {
  formula: Formula
  files: FileColumns[]
  onChange: (next: Formula) => void
}) {
  const kind = detectKind(formula)
  const defaultFile = files[0]?.filename ?? ''

  function changeKind(next: FormulaKind) {
    if (next === kind) return
    if (next === 'agg') onChange(emptyAgg(defaultFile))
    else if (next === 'composite') onChange(emptyComposite(defaultFile))
    else onChange(emptyConst())
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-1 bg-slate-900 w-fit">
        {(['agg', 'composite', 'const'] as FormulaKind[]).map((k) => (
          <button
            key={k}
            onClick={() => changeKind(k)}
            className={
              kind === k
                ? 'px-3 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'px-3 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }
          >
            {k === 'agg' ? 'Aggregation' : k === 'composite' ? 'Composite' : 'Constant'}
          </button>
        ))}
      </div>

      {kind === 'agg' && (
        <AggEditor agg={formula as AggOp} files={files} onChange={onChange} />
      )}
      {kind === 'composite' && (
        <CompositeEditor composite={formula as CompositeOp} files={files} onChange={onChange} />
      )}
      {kind === 'const' && (
        <Field label="Constant value">
          <input
            type="number"
            value={(formula as ConstOp).value ?? 0}
            onChange={(e) => onChange({ op: 'const', value: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      )}
    </div>
  )
}

function CompositeEditor({
  composite,
  files,
  onChange,
}: {
  composite: CompositeOp
  files: FileColumns[]
  onChange: (next: Formula) => void
}) {
  const op = composite.op
  const isDivide = op === 'divide'
  const leftLabel = isDivide ? 'Numerator' : 'Left'
  const rightLabel = isDivide ? 'Denominator' : 'Right'
  const leftFormula = (isDivide ? composite.numerator : composite.left) ?? emptyAgg(files[0]?.filename ?? '')
  const rightFormula = (isDivide ? composite.denominator : composite.right) ?? emptyAgg(files[0]?.filename ?? '')

  function setOp(next: CompositeOp['op']) {
    // Convert existing left/right between divide- and non-divide shapes
    const l = leftFormula
    const r = rightFormula
    if (next === 'divide') onChange({ op: 'divide', numerator: l, denominator: r })
    else onChange({ op: next, left: l, right: r })
  }
  function setLeft(next: Formula) {
    if (isDivide) onChange({ ...composite, numerator: next })
    else onChange({ ...composite, left: next })
  }
  function setRight(next: Formula) {
    if (isDivide) onChange({ ...composite, denominator: next })
    else onChange({ ...composite, right: next })
  }

  return (
    <div className="space-y-3">
      <Field label="Operation">
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as CompositeOp['op'])}
          className={inputCls}
        >
          {COMPOSITE_OPS.map((o) => (
            <option key={o} value={o}>
              {o === 'divide' ? 'divide (a / b)' : o === 'subtract' ? 'subtract (a − b)' : o === 'multiply' ? 'multiply (a × b)' : 'add (a + b)'}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/40">
          <div className="text-xs text-slate-400 mb-2">{leftLabel}</div>
          <NestedFormulaEditor formula={leftFormula} files={files} onChange={setLeft} />
        </div>
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/40">
          <div className="text-xs text-slate-400 mb-2">{rightLabel}</div>
          <NestedFormulaEditor formula={rightFormula} files={files} onChange={setRight} />
        </div>
      </div>
    </div>
  )
}

/** A simpler nested editor — only Aggregation or Constant. No nested composites in v1 to keep UI sane. */
function NestedFormulaEditor({
  formula,
  files,
  onChange,
}: {
  formula: Formula
  files: FileColumns[]
  onChange: (next: Formula) => void
}) {
  const kind = detectKind(formula)
  const defaultFile = files[0]?.filename ?? ''

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-1 bg-slate-900 w-fit">
        {(['agg', 'const'] as FormulaKind[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              if (k === kind) return
              onChange(k === 'agg' ? emptyAgg(defaultFile) : emptyConst())
            }}
            className={
              kind === k
                ? 'px-2 py-0.5 text-[11px] rounded bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'px-2 py-0.5 text-[11px] rounded text-slate-400 hover:text-slate-200'
            }
          >
            {k === 'agg' ? 'Aggregation' : 'Constant'}
          </button>
        ))}
      </div>
      {kind === 'agg' ? (
        <AggEditor agg={formula as AggOp} files={files} onChange={onChange} />
      ) : (
        <Field label="Value">
          <input
            type="number"
            value={(formula as ConstOp).value ?? 0}
            onChange={(e) => onChange({ op: 'const', value: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      )}
    </div>
  )
}

function AggEditor({
  agg,
  files,
  onChange,
}: {
  agg: AggOp
  files: FileColumns[]
  onChange: (next: AggOp) => void
}) {
  const sourceFile = files.find((f) => f.filename === agg.source) ?? null
  const filters = agg.filters ?? []

  function patch(p: Partial<AggOp>) {
    onChange({ ...agg, ...p })
  }
  function addFilter() {
    patch({ filters: [...filters, { column: sourceFile?.columns[0] ?? '', op: 'eq', value: '' }] })
  }
  function removeFilter(i: number) {
    patch({ filters: filters.filter((_, idx) => idx !== i) })
  }
  function updateFilter(i: number, p: Partial<Filter>) {
    patch({ filters: filters.map((f, idx) => (idx === i ? { ...f, ...p } : f)) })
  }

  const dateColumns = sourceFile?.columns.filter((c) =>
    /date|time|created|modified|at$|when/i.test(c)
  ) ?? []

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label="Op">
          <select value={agg.op} onChange={(e) => patch({ op: e.target.value as AggOp['op'] })} className={inputCls}>
            {AGG_OPS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Source file">
          <select value={agg.source} onChange={(e) => patch({ source: e.target.value })} className={inputCls}>
            {files.length === 0 && <option value="">— no files —</option>}
            {files.map((f) => (
              <option key={f.filename} value={f.filename}>{f.filename}</option>
            ))}
          </select>
        </Field>
        <Field label="Column">
          <select
            value={agg.column ?? ''}
            onChange={(e) => patch({ column: e.target.value || undefined })}
            className={inputCls}
            disabled={agg.op === 'count'}
          >
            <option value="">— none —</option>
            {sourceFile?.columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Timeframe column (optional)">
        <select
          value={agg.timeframe_column ?? ''}
          onChange={(e) => patch({ timeframe_column: e.target.value || undefined })}
          className={inputCls}
        >
          <option value="">— none (timeframe filter ignored) —</option>
          {(dateColumns.length > 0 ? dateColumns : sourceFile?.columns ?? []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Filters (AND)</span>
          <button onClick={addFilter} className="text-xs text-amber-400 hover:text-amber-300" disabled={!sourceFile}>
            + Add filter
          </button>
        </div>
        {filters.length === 0 ? (
          <p className="text-xs text-slate-500">No filters — all rows in the source counted.</p>
        ) : (
          <div className="space-y-2">
            {filters.map((f, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <select value={f.column} onChange={(e) => updateFilter(i, { column: e.target.value })} className={inputCls}>
                    {sourceFile?.columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <select value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value as Filter['op'] })} className={inputCls}>
                    {FILTER_OPS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  {f.op !== 'empty' && f.op !== 'not_empty' && (
                    <input
                      type="text"
                      value={Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '')}
                      onChange={(e) => {
                        const v = e.target.value
                        if (f.op === 'in' || f.op === 'not_in') {
                          updateFilter(i, { value: v.split(',').map((x) => x.trim()).filter(Boolean) })
                        } else {
                          updateFilter(i, { value: v })
                        }
                      }}
                      className={inputCls}
                      placeholder={f.op === 'in' || f.op === 'not_in' ? 'comma, separated' : 'value'}
                    />
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeFilter(i)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Live formula preview — debounced fetch to /preview, shows current value + row count + warnings. */
function FormulaPreview({
  slug,
  formula,
  format,
  viz,
}: {
  slug: string
  formula: Formula
  format: KPIFormat
  viz: KPIVizType
}) {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState<number | null>(null)
  const [rowsUsed, setRowsUsed] = useState<number>(0)
  const [sources, setSources] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Debounce
  const formulaJSON = useMemo(() => JSON.stringify(formula), [formula])

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/reporting/${slug}/kpis/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formula, format, viz_type: viz }),
        })
        const body = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(body.error || 'Preview failed')
          setValue(null)
        } else {
          const r = body.result
          setValue(r?.value ?? null)
          setRowsUsed(r?.rows_used ?? 0)
          setSources(r?.source_files ?? [])
          setError(r?.error ?? null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Preview failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [slug, formulaJSON, formula, format, viz])

  return (
    <div className="mt-3 pt-3 border-t border-slate-800 flex items-start gap-3">
      <Activity className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Live preview</div>
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-white">
              {loading ? '…' : formatKPIValue(value, format)}
            </span>
            <span className="text-[11px] text-slate-500">
              {rowsUsed.toLocaleString()} rows · {sources.length > 0 ? sources.join(', ') : 'no source matched'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function AdvancedKPIOptions({
  value,
  files,
  onChange,
}: {
  value: Omit<KPIRow, 'id' | 'client_id'>
  files: FileColumns[]
  onChange: (patch: Partial<KPIRow>) => void
}) {
  const groupSource = value.group_by_source ?? files[0]?.filename ?? ''
  const groupColumns = files.find((f) => f.filename === groupSource)?.columns ?? []
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Group by — source file">
          <select
            value={value.group_by_source ?? ''}
            onChange={(e) => onChange({ group_by_source: e.target.value || null, group_by_column: null })}
            className={inputCls}
          >
            <option value="">— none —</option>
            {files.map((f) => (
              <option key={f.filename} value={f.filename}>{f.filename}</option>
            ))}
          </select>
        </Field>
        <Field label="Group by — column">
          <select
            value={value.group_by_column ?? ''}
            onChange={(e) => onChange({ group_by_column: e.target.value || null })}
            className={inputCls}
            disabled={!value.group_by_source}
          >
            <option value="">— none —</option>
            {groupColumns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Compare to (period over period)">
        <select
          value={value.compare_to ?? ''}
          onChange={(e) => onChange({ compare_to: (e.target.value || null) as 'previous_period' | 'previous_year' | null })}
          className={inputCls}
        >
          <option value="">— none —</option>
          <option value="previous_period">Previous period (same span)</option>
          <option value="previous_year">Previous year (same dates)</option>
        </select>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Forecast — periods ahead">
          <input
            type="number"
            min={0}
            max={52}
            value={value.forecast_periods ?? 0}
            onChange={(e) => onChange({ forecast_periods: Number(e.target.value) || 0 })}
            className={inputCls}
            placeholder="0 = no forecast"
          />
        </Field>
        <Field label="Forecast — method">
          <select
            value={value.forecast_method ?? ''}
            onChange={(e) => onChange({ forecast_method: (e.target.value || null) as 'linear' | 'moving_avg' | null })}
            className={inputCls}
            disabled={!value.forecast_periods || value.forecast_periods === 0}
          >
            <option value="">— pick method —</option>
            <option value="linear">Linear regression</option>
            <option value="moving_avg">Moving average (last 4)</option>
          </select>
        </Field>
      </div>
      <p className="text-[11px] text-slate-500">
        Forecasting and trend charts require <span className="font-mono">viz_type = line / bar</span> and a <span className="font-mono">timeframe_column</span> on the formula.
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}
