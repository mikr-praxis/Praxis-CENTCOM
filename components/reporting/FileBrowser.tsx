'use client'

import { useEffect, useState } from 'react'
import { Database, X } from 'lucide-react'

interface ColumnInfo {
  name: string
  type: 'number' | 'date' | 'boolean' | 'text'
  distinct_count: number
  empty_count: number
  top_values: { value: string; count: number }[]
}

interface InspectResult {
  filename: string
  row_count: number
  columns: ColumnInfo[]
  sample_rows: Record<string, string>[]
}

interface Props {
  slug: string
  filenames: string[]
}

export function FileBrowser({ slug, filenames }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(filenames[0] ?? null)
  const [data, setData] = useState<InspectResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'columns' | 'rows'>('columns')

  useEffect(() => {
    if (!open || !active) return
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/reporting/${slug}/files/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: active }),
    })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Inspect failed')
        setData(body)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Inspect failed'))
      .finally(() => setLoading(false))
  }, [open, active, slug])

  if (filenames.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
      >
        <Database className="h-4 w-4" />
        Browse data
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
              <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-400" /> Browse data
              </h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1 p-3 border-b border-slate-700/50">
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

            <div className="flex items-center gap-1 px-3 pt-3">
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

            <div className="flex-1 overflow-y-auto p-3">
              {loading && <p className="text-sm text-slate-400">Loading…</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
              {!loading && !error && data && tab === 'columns' && (
                <div className="space-y-2">
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
                <div className="overflow-x-auto">
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
          </div>
        </div>
      )}
    </>
  )
}
