'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

interface DrillResp {
  kpi_id: string
  display_name: string
  source: string
  columns: string[]
  total_rows: number
  page: number
  page_size: number
  rows: Record<string, unknown>[]
}

interface Props {
  slug: string
  kpiId: string
  timeframe?: { start: string | null; end: string | null }
  onClose: () => void
}

export function DrillDownModal({ slug, kpiId, timeframe, onClose }: Props) {
  const [data, setData] = useState<DrillResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (timeframe?.start) params.set('start', timeframe.start)
    if (timeframe?.end) params.set('end', timeframe.end)
    params.set('page', String(page))
    fetch(`/api/reporting/${slug}/kpis/${kpiId}/drill?${params.toString()}`)
      .then(async (r) => {
        const b = await r.json()
        if (!r.ok) throw new Error(b.error || 'Failed')
        setData(b)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Drill-down failed'))
      .finally(() => setLoading(false))
  }, [slug, kpiId, page, timeframe?.start, timeframe?.end])

  function exportCsv() {
    if (!data) return
    const lines = [data.columns.join(',')]
    for (const row of data.rows) {
      const cells = data.columns.map((c) => {
        const v = row[c] == null ? '' : String(row[c])
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      })
      lines.push(cells.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.display_name.toLowerCase().replace(/\s+/g, '-')}-page${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total_rows / data.page_size)) : 1

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-white">{data?.display_name ?? 'Drill-down'}</h2>
            {data && (
              <p className="text-xs text-slate-500 mt-0.5">
                {data.total_rows.toLocaleString()} contributing rows from{' '}
                <span className="font-mono">{data.source}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && data.rows.length > 0 && (
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-slate-400">Loading…</p>}
          {error && <p className="p-4 text-sm text-red-400">{error}</p>}
          {data && data.rows.length === 0 && !loading && (
            <p className="p-4 text-sm text-slate-400">No rows match the current filters.</p>
          )}
          {data && data.rows.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-slate-800/40 sticky top-0">
                <tr>
                  {data.columns.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    {data.columns.map((c) => (
                      <td key={c} className="px-2 py-1 text-slate-300 whitespace-nowrap max-w-[260px] truncate">
                        {String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.total_rows > data.page_size && (
          <div className="flex items-center justify-between p-3 border-t border-slate-700/50 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
