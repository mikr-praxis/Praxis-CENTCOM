'use client'

/**
 * KPIConfigModal — per-KPI mapping form for the curated catalog.
 *
 * Given a `CatalogEntry`, the modal walks the user through: (optionally) a
 * variant picker, then per-input file + column mapping (with optional row
 * filters), then saves. Builds the JSON Formula via the catalog entry's
 * `build()` and writes to /api/reporting/[slug]/kpis (POST for new, PATCH
 * for edit).
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { X, Plus, Trash2, AlertCircle, Check } from 'lucide-react'
import type {
  CatalogEntry,
  CatalogInput,
  CatalogInputState,
  CatalogInputValue,
  CatalogVariant,
} from '@/lib/reporting/kpi-catalog'
import type { Filter } from '@/lib/reporting/types'
import type { KPIVizType, ChartOptions } from '@/lib/supabase/types'
import { VizOptionsEditor } from './VizOptionsEditor'

const VIZ_TYPES: { value: KPIVizType; label: string }[] = [
  { value: 'card', label: 'Card (single number)' },
  { value: 'line', label: 'Line chart' },
  { value: 'bar', label: 'Bar chart' },
  { value: 'area', label: 'Area chart' },
  { value: 'pie', label: 'Pie chart' },
  { value: 'table', label: 'Table' },
  { value: 'gauge', label: 'Gauge' },
]

interface InspectColumn {
  name: string
  type: 'number' | 'date' | 'boolean' | 'text'
  distinct_count: number
  top_values: { value: string; count: number }[]
}

interface Props {
  slug: string
  entry: CatalogEntry
  filenames: string[]
  /** When provided the modal opens in edit mode and PATCHes instead of POSTs. */
  existingKpiId?: string
  /** Pre-fill values when editing. */
  initialState?: Record<string, CatalogInputValue>
  initialVariantId?: string
  /** Pre-fill viz type when editing an existing KPI. */
  initialVizType?: KPIVizType
  /** Pre-fill chart options when editing. */
  initialChartOptions?: ChartOptions
  onClose: () => void
  onSaved: () => void
}

export function KPIConfigModal({
  slug,
  entry,
  filenames,
  existingKpiId,
  initialState,
  initialVariantId,
  initialVizType,
  initialChartOptions,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!existingKpiId

  const [variantId, setVariantId] = useState<string | null>(
    initialVariantId ?? entry.variants?.[0]?.id ?? null
  )

  const variant: CatalogVariant | null = useMemo(() => {
    if (!entry.variants) return null
    return entry.variants.find((v) => v.id === variantId) ?? entry.variants[0] ?? null
  }, [entry.variants, variantId])

  const inputs: CatalogInput[] = variant ? variant.inputs : entry.inputs ?? []

  // Visualization type + chart options — exposed for non-card viz, persisted
  // alongside the formula on save.
  const [vizType, setVizType] = useState<KPIVizType>(initialVizType ?? entry.viz_type)
  const [chartOptions, setChartOptions] = useState<ChartOptions>(initialChartOptions ?? {})

  // Per-input state. For non-repeatable, holds a single object. For repeatable, an array.
  const [state, setState] = useState<Record<string, CatalogInputValue>>(() => {
    if (initialState) return initialState
    const init: Record<string, CatalogInputValue> = {}
    for (const i of inputs) {
      init[i.id] = i.repeatable ? [{ source: '', column: '' }] : { source: '', column: '' }
    }
    return init
  })

  // Reset state when the variant changes (only when no initialState was provided).
  useEffect(() => {
    if (initialState) return
    const init: Record<string, CatalogInputValue> = {}
    for (const i of inputs) {
      init[i.id] = i.repeatable ? [{ source: '', column: '' }] : { source: '', column: '' }
    }
    setState(init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId])

  // Per-file column cache so we only inspect each file once.
  const [columnsByFile, setColumnsByFile] = useState<Record<string, InspectColumn[]>>({})
  const [inspecting, setInspecting] = useState<Set<string>>(new Set())

  const inspectFile = useCallback(
    async (filename: string) => {
      if (!filename) return
      if (columnsByFile[filename]) return
      setInspecting((prev) => new Set(prev).add(filename))
      try {
        const res = await fetch(`/api/reporting/${slug}/files/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }),
        })
        const body = await res.json()
        if (res.ok && Array.isArray(body.columns)) {
          setColumnsByFile((prev) => ({ ...prev, [filename]: body.columns }))
        }
      } catch {
        /* leave empty */
      } finally {
        setInspecting((prev) => {
          const next = new Set(prev)
          next.delete(filename)
          return next
        })
      }
    },
    [columnsByFile, slug]
  )

  // Pre-warm the cache for any file already referenced in initialState.
  useEffect(() => {
    if (!initialState) return
    const seen = new Set<string>()
    for (const v of Object.values(initialState)) {
      const list = Array.isArray(v) ? v : [v]
      for (const s of list) if (s.source) seen.add(s.source)
    }
    seen.forEach((f) => inspectFile(f))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateSingle(inputId: string, patch: Partial<CatalogInputState>) {
    setState((prev) => {
      const cur = prev[inputId]
      if (Array.isArray(cur)) return prev
      return { ...prev, [inputId]: { ...(cur ?? { source: '', column: '' }), ...patch } }
    })
  }

  function updateAt(inputId: string, idx: number, patch: Partial<CatalogInputState>) {
    setState((prev) => {
      const cur = prev[inputId]
      if (!Array.isArray(cur)) return prev
      const next = [...cur]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, [inputId]: next }
    })
  }

  function addRow(inputId: string) {
    setState((prev) => {
      const cur = prev[inputId]
      const list = Array.isArray(cur) ? cur : []
      return { ...prev, [inputId]: [...list, { source: '', column: '' }] }
    })
  }

  function removeRow(inputId: string, idx: number) {
    setState((prev) => {
      const cur = prev[inputId]
      if (!Array.isArray(cur)) return prev
      const next = cur.filter((_, i) => i !== idx)
      return { ...prev, [inputId]: next.length === 0 ? [{ source: '', column: '' }] : next }
    })
  }

  function addFilter(inputId: string, idx: number | null) {
    const newFilter: Filter = { column: '', op: 'eq', value: '' }
    setState((prev) => {
      const cur = prev[inputId]
      if (idx == null) {
        if (Array.isArray(cur)) return prev
        const filters = [...((cur as CatalogInputState | undefined)?.filters ?? []), newFilter]
        return { ...prev, [inputId]: { ...(cur as CatalogInputState ?? { source: '', column: '' }), filters } }
      }
      if (!Array.isArray(cur)) return prev
      const next = [...cur]
      const target = next[idx]
      next[idx] = { ...target, filters: [...(target.filters ?? []), newFilter] }
      return { ...prev, [inputId]: next }
    })
  }

  function updateFilter(inputId: string, idx: number | null, fIdx: number, patch: Partial<Filter>) {
    setState((prev) => {
      const cur = prev[inputId]
      if (idx == null) {
        if (Array.isArray(cur)) return prev
        const filters = [...((cur as CatalogInputState | undefined)?.filters ?? [])]
        filters[fIdx] = { ...filters[fIdx], ...patch }
        return { ...prev, [inputId]: { ...(cur as CatalogInputState ?? { source: '', column: '' }), filters } }
      }
      if (!Array.isArray(cur)) return prev
      const next = [...cur]
      const target = next[idx]
      const filters = [...(target.filters ?? [])]
      filters[fIdx] = { ...filters[fIdx], ...patch }
      next[idx] = { ...target, filters }
      return { ...prev, [inputId]: next }
    })
  }

  function removeFilter(inputId: string, idx: number | null, fIdx: number) {
    setState((prev) => {
      const cur = prev[inputId]
      if (idx == null) {
        if (Array.isArray(cur)) return prev
        const filters = ((cur as CatalogInputState | undefined)?.filters ?? []).filter((_, i) => i !== fIdx)
        return { ...prev, [inputId]: { ...(cur as CatalogInputState ?? { source: '', column: '' }), filters } }
      }
      if (!Array.isArray(cur)) return prev
      const next = [...cur]
      const target = next[idx]
      const filters = (target.filters ?? []).filter((_, i) => i !== fIdx)
      next[idx] = { ...target, filters }
      return { ...prev, [inputId]: next }
    })
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const builder = variant ? variant.build : entry.build
    if (!builder) {
      setError('Internal error: no formula builder for this catalog entry')
      return
    }
    const formula = builder(state)
    if (!formula) {
      setError('Please fill in all required source + column fields.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        key: entry.catalog_key,
        display_name: entry.display_name,
        description: entry.description,
        format: entry.format,
        viz_type: vizType,
        formula,
        ...(Object.keys(chartOptions).length > 0 ? { chart_options: chartOptions } : {}),
      }
      const url = isEdit
        ? `/api/reporting/${slug}/kpis/${existingKpiId}`
        : `/api/reporting/${slug}/kpis`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isEdit ? 'Edit ' : 'Configure '}
              {entry.display_name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{entry.description}</p>
          </div>
          <button
            onClick={() => !saving && onClose()}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Variant picker */}
        {entry.variants && entry.variants.length > 0 && (
          <div className="p-5 border-b border-slate-800">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Conversion type</div>
            <div className="space-y-2">
              {entry.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    v.id === variantId
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
                      : 'border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {v.id === variantId && <Check className="h-3.5 w-3.5 text-amber-400" />}
                    <span className="font-medium">{v.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{v.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input mapping */}
        <div className="p-5 space-y-5">
          {isEdit && !initialState && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Editing.</strong> Re-select the source file + column for each input below to update the formula. Viz type + chart options below pre-fill from the saved tile.
              </div>
            </div>
          )}
          {filenames.length === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>No synced files yet. Sync this client's Drive folder first, then come back.</div>
            </div>
          )}

          {inputs.map((input) => {
            const value = state[input.id]
            if (input.repeatable) {
              const list = Array.isArray(value) ? value : [{ source: '', column: '' }]
              return (
                <div key={input.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{input.label}</div>
                      {input.hint && <div className="text-[11px] text-slate-400 mt-0.5">{input.hint}</div>}
                    </div>
                  </div>
                  {list.map((row, idx) => (
                    <SourceColumnRow
                      key={idx}
                      input={input}
                      state={row}
                      filenames={filenames}
                      columnsByFile={columnsByFile}
                      inspecting={inspecting}
                      onInspect={inspectFile}
                      onChange={(patch) => updateAt(input.id, idx, patch)}
                      onAddFilter={() => addFilter(input.id, idx)}
                      onUpdateFilter={(fIdx, patch) => updateFilter(input.id, idx, fIdx, patch)}
                      onRemoveFilter={(fIdx) => removeFilter(input.id, idx, fIdx)}
                      removable={list.length > 1}
                      onRemove={() => removeRow(input.id, idx)}
                    />
                  ))}
                  <button
                    onClick={() => addRow(input.id)}
                    className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 px-2 py-1"
                  >
                    <Plus className="h-3 w-3" /> Add another source
                  </button>
                </div>
              )
            }

            const single = !Array.isArray(value) ? value : { source: '', column: '' }
            return (
              <div key={input.id} className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-white">{input.label}</div>
                  {input.hint && <div className="text-[11px] text-slate-400 mt-0.5">{input.hint}</div>}
                </div>
                <SourceColumnRow
                  input={input}
                  state={single}
                  filenames={filenames}
                  columnsByFile={columnsByFile}
                  inspecting={inspecting}
                  onInspect={inspectFile}
                  onChange={(patch) => updateSingle(input.id, patch)}
                  onAddFilter={() => addFilter(input.id, null)}
                  onUpdateFilter={(fIdx, patch) => updateFilter(input.id, null, fIdx, patch)}
                  onRemoveFilter={(fIdx) => removeFilter(input.id, null, fIdx)}
                />
              </div>
            )
          })}
        </div>

        {/* Visualization */}
        <div className="px-5 pb-5 space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Viz type</label>
            <select
              value={vizType}
              onChange={(e) => setVizType(e.target.value as KPIVizType)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white"
            >
              {VIZ_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <details className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
            <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500 hover:text-slate-300">
              Visualization options — color, axis, legend, top-N
            </summary>
            <VizOptionsEditor
              vizType={vizType}
              options={chartOptions}
              onChange={setChartOptions}
            />
          </details>
        </div>

        {error && (
          <div className="px-5 pb-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={() => !saving && onClose()}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || filenames.length === 0}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add tile'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SourceColumnRow({
  input,
  state,
  filenames,
  columnsByFile,
  inspecting,
  onInspect,
  onChange,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  removable,
  onRemove,
}: {
  input: CatalogInput
  state: CatalogInputState
  filenames: string[]
  columnsByFile: Record<string, InspectColumn[]>
  inspecting: Set<string>
  onInspect: (filename: string) => void
  onChange: (patch: Partial<CatalogInputState>) => void
  onAddFilter: () => void
  onUpdateFilter: (fIdx: number, patch: Partial<Filter>) => void
  onRemoveFilter: (fIdx: number) => void
  removable?: boolean
  onRemove?: () => void
}) {
  const cols = state.source ? columnsByFile[state.source] ?? [] : []
  const isInspecting = state.source ? inspecting.has(state.source) : false

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Source file</label>
          <select
            value={state.source}
            onChange={(e) => {
              const f = e.target.value
              onChange({ source: f, column: '' })
              if (f) onInspect(f)
            }}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white"
          >
            <option value="">—</option>
            {filenames.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Column</label>
          <select
            value={state.column}
            onChange={(e) => onChange({ column: e.target.value })}
            disabled={!state.source || isInspecting}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white disabled:opacity-50"
          >
            <option value="">{isInspecting ? 'Loading columns…' : '—'}</option>
            {cols.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.type !== 'text' ? `(${c.type})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      {(state.filters ?? []).length > 0 && (
        <div className="space-y-1.5 pt-1">
          {(state.filters ?? []).map((f, fIdx) => (
            <div key={fIdx} className="grid grid-cols-12 gap-1.5 items-center">
              <select
                value={f.column}
                onChange={(e) => onUpdateFilter(fIdx, { column: e.target.value })}
                className="col-span-4 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
              >
                <option value="">column…</option>
                {cols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={f.op}
                onChange={(e) => onUpdateFilter(fIdx, { op: e.target.value as Filter['op'] })}
                className="col-span-3 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
              >
                <option value="eq">=</option>
                <option value="neq">≠</option>
                <option value="contains">contains</option>
                <option value="not_empty">not empty</option>
                <option value="empty">empty</option>
                <option value="gt">&gt;</option>
                <option value="gte">≥</option>
                <option value="lt">&lt;</option>
                <option value="lte">≤</option>
              </select>
              <input
                value={typeof f.value === 'string' || typeof f.value === 'number' ? String(f.value) : ''}
                onChange={(e) => onUpdateFilter(fIdx, { value: e.target.value })}
                disabled={f.op === 'not_empty' || f.op === 'empty'}
                placeholder="value"
                className="col-span-4 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50"
              />
              <button
                onClick={() => onRemoveFilter(fIdx)}
                className="col-span-1 p-1 rounded hover:bg-slate-700 text-slate-400"
                aria-label="Remove filter"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {input.filterable ? (
          <button
            onClick={onAddFilter}
            className="text-[11px] text-slate-400 hover:text-amber-300 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add row filter
          </button>
        ) : (
          <span />
        )}
        {removable && onRemove && (
          <button
            onClick={onRemove}
            className="text-[11px] text-slate-500 hover:text-red-400 inline-flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Remove source
          </button>
        )}
      </div>
    </div>
  )
}
