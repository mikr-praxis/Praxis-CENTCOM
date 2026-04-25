'use client'

import { useState } from 'react'
import { Target, AlertCircle, ArrowDown, ArrowUp, ChevronRight, Database } from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import type { KPIResult } from '@/lib/reporting/types'
import { DrillDownModal } from './DrillDownModal'

interface Props {
  results: KPIResult[]
  loading: boolean
  /** Pass slug + timeframe so cards can open the drill-down for their KPI */
  slug?: string
  timeframe?: { start: string | null; end: string | null }
}

export function KPICardGrid({ results, loading, slug, timeframe }: Props) {
  const [drillKpiId, setDrillKpiId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-slate-700/50 bg-slate-900/50 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (results.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {results.map((r) => (
          <KPICard
            key={r.kpi_id}
            result={r}
            onDrillDown={slug ? () => setDrillKpiId(r.kpi_id) : undefined}
          />
        ))}
      </div>
      {slug && drillKpiId && (
        <DrillDownModal
          slug={slug}
          kpiId={drillKpiId}
          timeframe={timeframe}
          onClose={() => setDrillKpiId(null)}
        />
      )}
    </>
  )
}

function KPICard({ result, onDrillDown }: { result: KPIResult; onDrillDown?: () => void }) {
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

  const cmp = result.compare
  const deltaPos = cmp?.delta_absolute != null && cmp.delta_absolute > 0
  const deltaNeg = cmp?.delta_absolute != null && cmp.delta_absolute < 0

  return (
    <div className={`p-4 rounded-xl border bg-slate-900 ${borderClass}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-slate-500 truncate">{result.display_name}</span>
        {result.error && <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
        {!result.error && result.target != null && (
          <Target className={`h-4 w-4 flex-shrink-0 ${meetingTarget ? 'text-emerald-400' : 'text-amber-400'}`} />
        )}
      </div>
      <button
        onClick={onDrillDown}
        disabled={!onDrillDown || result.value == null}
        className="text-2xl font-semibold text-white hover:text-amber-300 disabled:hover:text-white disabled:cursor-default text-left"
        title={onDrillDown ? 'Click to see contributing rows' : undefined}
      >
        {display}
      </button>

      {/* Period-over-period delta */}
      {cmp && cmp.delta_percent != null && (
        <div
          className={
            deltaPos
              ? 'inline-flex items-center gap-0.5 mt-1 text-xs text-emerald-400'
              : deltaNeg
                ? 'inline-flex items-center gap-0.5 mt-1 text-xs text-red-400'
                : 'inline-flex items-center gap-0.5 mt-1 text-xs text-slate-500'
          }
        >
          {deltaPos && <ArrowUp className="h-3 w-3" />}
          {deltaNeg && <ArrowDown className="h-3 w-3" />}
          <span>
            {(cmp.delta_percent * 100).toFixed(1)}%
          </span>
          <span className="text-slate-500 ml-1">
            (was {formatKPIValue(cmp.previous_value, result.format)})
          </span>
        </div>
      )}

      {/* Group-by mini breakdown */}
      {result.groups && result.groups.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-800 space-y-0.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 inline-flex items-center gap-1">
            <Database className="h-3 w-3" /> Top breakdown
          </span>
          {result.groups.slice(0, 5).map((g) => (
            <div key={g.group} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 truncate max-w-[55%]">{g.group}</span>
              <span className="text-slate-200 font-mono">{formatKPIValue(g.value, result.format)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{result.rows_used.toLocaleString()} rows</span>
        {result.target != null && (
          <span>Target: {formatKPIValue(result.target, result.format)}</span>
        )}
      </div>
      {result.error && (
        <p className="mt-2 text-xs text-red-400 line-clamp-2">{result.error}</p>
      )}
      {onDrillDown && result.value != null && (
        <button
          onClick={onDrillDown}
          className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-amber-400"
        >
          Drill in <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
