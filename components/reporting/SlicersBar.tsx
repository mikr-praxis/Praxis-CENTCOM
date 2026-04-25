'use client'

import { useEffect, useMemo, useState } from 'react'
import { Filter, Plus, X, Check } from 'lucide-react'
import type { Slicer } from '@/lib/reporting/types'

interface FileMeta {
  filename: string
  columns: string[]
}

interface ColumnValuesResp {
  values: { value: string; count: number }[]
}

interface Props {
  slug: string
  /** Files that have synced data — surfaced as the source picker. */
  files: FileMeta[]
  slicers: Slicer[]
  onChange: (next: Slicer[]) => void
}

export function SlicersBar({ slug, files, slicers, onChange }: Props) {
  const [adderOpen, setAdderOpen] = useState(false)
  const [pickFile, setPickFile] = useState<string>('')
  const [pickColumn, setPickColumn] = useState<string>('')
  const [columnsForFile, setColumnsForFile] = useState<string[]>([])
  const [values, setValues] = useState<{ value: string; count: number }[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedFile = useMemo(() => files.find((f) => f.filename === pickFile) ?? null, [files, pickFile])

  // Load full columns when file picked (covers the case where caller's `files` only has filenames)
  useEffect(() => {
    if (!pickFile) return
    if (selectedFile && selectedFile.columns.length > 0) {
      setColumnsForFile(selectedFile.columns)
      return
    }
    fetch(`/api/reporting/${slug}/files/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: pickFile }),
    })
      .then((r) => r.json())
      .then((b) => setColumnsForFile((b.columns ?? []).map((c: { name: string }) => c.name)))
      .catch(() => setColumnsForFile([]))
  }, [pickFile, selectedFile, slug])

  // Load distinct values for column
  useEffect(() => {
    if (!pickFile || !pickColumn) {
      setValues([])
      setSelected(new Set())
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/reporting/${slug}/event-column/values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: pickFile, column: pickColumn }),
    })
      .then(async (r) => {
        const b = (await r.json()) as ColumnValuesResp & { error?: string }
        if (!r.ok) throw new Error(b.error || 'Failed to load values')
        setValues(b.values ?? [])
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Load failed')
        setValues([])
      })
      .finally(() => setLoading(false))
  }, [pickFile, pickColumn, slug])

  function toggleValue(v: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  function applySlicer() {
    if (!pickFile || !pickColumn || selected.size === 0) return
    // Replace any existing slicer on the same (file, column), append otherwise
    const next = slicers.filter((s) => !(s.filename === pickFile && s.column === pickColumn))
    next.push({ filename: pickFile, column: pickColumn, values: Array.from(selected) })
    onChange(next)
    setAdderOpen(false)
    setPickFile('')
    setPickColumn('')
    setValues([])
    setSelected(new Set())
  }

  function removeSlicer(i: number) {
    const next = [...slicers]
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Filter className="h-3.5 w-3.5" /> Slicers:
      </span>
      {slicers.length === 0 && !adderOpen && <span className="text-xs text-slate-500">none</span>}
      {slicers.map((s, i) => (
        <span
          key={`${s.filename}|${s.column}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200"
        >
          <span className="font-mono text-[10px] text-amber-300/70">{s.filename}.{s.column}</span>
          <span className="text-amber-100">∈</span>
          <span className="truncate max-w-[180px]">{s.values.join(', ')}</span>
          <button onClick={() => removeSlicer(i)} className="ml-1 text-amber-300 hover:text-amber-100">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {!adderOpen ? (
        <button
          onClick={() => setAdderOpen(true)}
          disabled={files.length === 0}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Add slicer
        </button>
      ) : (
        <div className="w-full mt-1 p-3 rounded-lg border border-slate-700 bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">New slicer</span>
            <button
              onClick={() => setAdderOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={pickFile}
              onChange={(e) => {
                setPickFile(e.target.value)
                setPickColumn('')
              }}
              className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
            >
              <option value="">— file —</option>
              {files.map((f) => (
                <option key={f.filename} value={f.filename}>{f.filename}</option>
              ))}
            </select>
            <select
              value={pickColumn}
              onChange={(e) => setPickColumn(e.target.value)}
              disabled={!pickFile || columnsForFile.length === 0}
              className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 disabled:opacity-50"
            >
              <option value="">— column —</option>
              {columnsForFile.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {pickColumn && (
            <div className="rounded border border-slate-700 max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-xs text-slate-500">Loading values…</div>
              ) : values.length === 0 ? (
                <div className="p-2 text-xs text-slate-500">No values.</div>
              ) : (
                values.map((v) => (
                  <label
                    key={v.value}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-800/40 cursor-pointer border-b border-slate-800 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(v.value)}
                      onChange={() => toggleValue(v.value)}
                    />
                    <span className="flex-1 truncate text-slate-200">{v.value}</span>
                    <span className="font-mono text-slate-500">{v.count}</span>
                  </label>
                ))
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdderOpen(false)}
              className="px-3 py-1 text-xs rounded text-slate-400 hover:bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={applySlicer}
              disabled={!pickFile || !pickColumn || selected.size === 0}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> Apply ({selected.size})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
