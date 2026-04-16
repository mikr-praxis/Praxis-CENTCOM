'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { MetricType } from '@/lib/metrics/types'
import { formatMetricValue } from '@/lib/metrics'

interface KPICardProps {
  label: string
  value: number
  format: MetricType
  delta?: number
  benchmark?: { weak: number; strong: number }
  confidence?: 'direct' | 'derived' | 'estimated'
}

export function KPICard({ label, value, format, delta, benchmark, confidence }: KPICardProps) {
  const formattedValue = formatMetricValue(value, format)

  let color = 'border-zinc-800'
  if (benchmark) {
    if (value >= benchmark.strong) color = 'border-emerald-500/30'
    else if (value >= benchmark.weak) color = 'border-amber-400/30'
    else color = 'border-red-500/30'
  }

  return (
    <div className={`bg-zinc-900 rounded-xl border ${color} p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        {confidence && confidence !== 'direct' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
            {confidence}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-100">{formattedValue}</p>
      {delta !== undefined && (
        <div className="flex items-center gap-1">
          {delta > 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : delta < 0 ? (
            <TrendingDown className="h-3 w-3 text-red-400" />
          ) : (
            <Minus className="h-3 w-3 text-slate-500" />
          )}
          <span className={`text-xs ${
            delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'
          }`}>
            {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
          </span>
          <span className="text-xs text-slate-600">vs prior</span>
        </div>
      )}
    </div>
  )
}
