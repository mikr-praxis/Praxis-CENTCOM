'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react'
import type { AggOp, Formula, Filter } from '@/lib/reporting/types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

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
}

interface Props {
  client: { id: string; slug: string; name: string }
  kpis: KPIRow[]
  files: FileColumns[]
}

const FORMAT_OPTIONS: KPIFormat[] = ['count', 'currency', 'percent', 'ratio']
const VIZ_OPTIONS: KPIVizType[] = ['card', 'line', 'bar', 'pie', 'table']
const AGG_OPS: AggOp['op'][] = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max']
const FILTER_OPS: Filter['op'][] = ['eq', 'neq', 'in', 'not_in', 'contains', 'gt', 'gte', 'lt', 'lte', 'not_empty', 'empty']

function emptyAgg(filename: string): AggOp {
  return { op: 'count', source: filename, filters: [] }
}

function emptyKPI(filename: string): Omit<KPIRow, 'id' | 'client_id'> {
  return {
    key: '',
    display_name: '',
    description: null,
    formula: emptyAgg(filename),
    format: 'count',
    target: null,
    viz_type: 'card',
    display_order: 0,
  }
}

export function ConfigureClient({ client, kpis: initialKpis, files }: Props) {
  const [kpis, setKpis] = useState<KPIRow[]>(initialKpis)
  const [adding, setAdding] = useState(false)
  const defaultFile = files[0]?.filename ?? ''
  const [draft, setDraft] = useState<Omit<KPIRow, 'id' | 'client_id'>>(emptyKPI(defaultFile))
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
      setDraft(emptyKPI(defaultFile))
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configure KPIs — {client.name}</h1>
          <p className="text-slate-400 text-sm mt-1">Define metrics computed from synced raw files.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          disabled={adding || files.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add KPI
        </button>
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
          value={draft}
          files={files}
          onChange={(d) => setDraft(d)}
          onCancel={() => {
            setAdding(false)
            setDraft(emptyKPI(defaultFile))
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
              value={kpi}
              files={files}
              onChange={(patch) => updateKpi(kpi.id, patch)}
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
  value: Omit<KPIRow, 'id' | 'client_id'> & Partial<Pick<KPIRow, 'id' | 'client_id'>>
  files: FileColumns[]
  onChange: (patch: KPIRow | Omit<KPIRow, 'id' | 'client_id'>) => void
  onSave: () => void
  onCancel?: () => void
  onDelete?: () => void
  isNew?: boolean
  saving?: boolean
}

function KPIEditor({ value, files, onChange, onSave, onCancel, onDelete, isNew, saving }: KPIEditorProps) {
  function setField<K extends keyof typeof value>(field: K, v: (typeof value)[K]) {
    onChange({ ...value, [field]: v } as KPIRow)
  }

  // Only AggOp formulas are editable in v1 (composite ops are stored but not editable in this UI yet)
  const formula = value.formula
  const isAgg = ['sum', 'count', 'count_distinct', 'avg', 'min', 'max'].includes((formula as AggOp).op)
  const agg = isAgg ? (formula as AggOp) : null
  const sourceFile = files.find((f) => f.filename === agg?.source) ?? null

  function setFormula(next: AggOp) {
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
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
            placeholder="Total revenue"
          />
        </Field>
        <Field label="Key (slug)">
          <input
            type="text"
            value={value.key}
            onChange={(e) => setField('key', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
            placeholder="total_revenue"
          />
        </Field>
        <Field label="Format">
          <select
            value={value.format}
            onChange={(e) => setField('format', e.target.value as KPIFormat)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
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
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
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
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
            placeholder="e.g. 50000"
          />
        </Field>
        <Field label="Display order">
          <input
            type="number"
            value={value.display_order}
            onChange={(e) => setField('display_order', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={value.description ?? ''}
          onChange={(e) => setField('description', e.target.value || null)}
          rows={2}
          className="input"
          placeholder="What this KPI measures."
        />
      </Field>

      <div className="mt-4 p-3 rounded-lg border border-slate-700 bg-slate-950/40">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Formula</div>
        {agg ? (
          <FormulaEditor
            agg={agg}
            files={files}
            sourceFile={sourceFile}
            onChange={setFormula}
          />
        ) : (
          <p className="text-sm text-slate-400">
            This KPI uses a composite formula (e.g. divide). Composite editing will land in M5.
          </p>
        )}
      </div>

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

function FormulaEditor({
  agg,
  files,
  sourceFile,
  onChange,
}: {
  agg: AggOp
  files: FileColumns[]
  sourceFile: FileColumns | null
  onChange: (next: AggOp) => void
}) {
  function patch(p: Partial<AggOp>) {
    onChange({ ...agg, ...p })
  }

  const filters = agg.filters ?? []

  function addFilter() {
    patch({ filters: [...filters, { column: sourceFile?.columns[0] ?? '', op: 'eq', value: '' }] })
  }
  function removeFilter(i: number) {
    patch({ filters: filters.filter((_, idx) => idx !== i) })
  }
  function updateFilter(i: number, p: Partial<Filter>) {
    patch({
      filters: filters.map((f, idx) => (idx === i ? { ...f, ...p } : f)),
    })
  }

  const dateColumns = sourceFile?.columns.filter((c) =>
    /date|time|created|modified|at$|when/i.test(c)
  ) ?? []

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label="Op">
          <select
            value={agg.op}
            onChange={(e) => patch({ op: e.target.value as AggOp['op'] })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
          >
            {AGG_OPS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Source file">
          <select
            value={agg.source}
            onChange={(e) => patch({ source: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
          >
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
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
            disabled={agg.op === 'count'}
          >
            <option value="">— none —</option>
            {sourceFile?.columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Timeframe column">
        <select
          value={agg.timeframe_column ?? ''}
          onChange={(e) => patch({ timeframe_column: e.target.value || undefined })}
          className="input"
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
          <button
            onClick={addFilter}
            className="text-xs text-amber-400 hover:text-amber-300"
            disabled={!sourceFile}
          >
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
                  <select
                    value={f.column}
                    onChange={(e) => updateFilter(i, { column: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                  >
                    {sourceFile?.columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <select
                    value={f.op}
                    onChange={(e) => updateFilter(i, { op: e.target.value as Filter['op'] })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                  >
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
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                      placeholder={f.op === 'in' || f.op === 'not_in' ? 'comma, separated' : 'value'}
                    />
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeFilter(i)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                  >
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}
