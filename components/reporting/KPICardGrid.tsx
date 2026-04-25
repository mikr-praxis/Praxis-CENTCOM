'use client'

import { Target, AlertCircle } from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import type { KPIResult } from '@/lib/reporting/types'

interface Props {
  results: KPIResult[]
  loading: boolean
}

export function KPICardGrid({ results, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-slate-700/50 bg-slate-900/50 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (results.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {results.map((r) => (
        <KPICard key={r.kpi_id} result={r} />
      ))}
    </div>
  )
}

function KPICard({ result }: { result: KPIResult }) {
  const display = formatKPIValue(result.value, result.format)
  const meetingTarget =
    result.target != null && result.value != null && result.value >= result.target

  const borderClass = result.error
    ? 'border-red-500/30'
    : result.target != null
      ? meetingTarget
        ? 'border-emerald-500/40'
        : 'border-amber-500/40'
      : 'border-slate-700/50'

  return (
    <div className={`p-4 rounded-xl border bg-slate-900 ${borderClass}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-slate-500 truncate">{result.display_name}</span>
        {result.error && <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
        {!result.error && result.target != null && (
          <Target className={`h-4 w-4 flex-shrink-0 ${meetingTarget ? 'text-emerald-400' : 'text-amber-400'}`} />
        )}
      </div>
      <div className="text-2xl font-semibold text-white">{display}</div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{result.rows_used.toLocaleString()} rows</span>
        {result.target != null && (
          <span>Target: {formatKPIValue(result.target, result.format)}</span>
        )}
      </div>
      {result.error && (
        <p className="mt-2 text-xs text-red-400 line-clamp-2">{result.error}</p>
      )}
    </div>
  )
}
