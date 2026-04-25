'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { formatKPIValue } from '@/lib/reporting/engine'
import type { KPIResult } from '@/lib/reporting/types'

interface Props {
  result: KPIResult
}

export function ChartBlock({ result }: Props) {
  const series = result.series ?? []
  const data = series.map((p) => ({
    bucket: p.bucket,
    value: p.value ?? 0,
  }))

  const hasData = data.some((d) => d.value !== 0)

  if (!hasData && series.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900">
        <h3 className="text-sm font-semibold text-white mb-1">{result.display_name}</h3>
        <p className="text-xs text-slate-500">
          {result.error
            ? result.error
            : 'No time series available — set a Timeframe column on the KPI to enable charts.'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{result.display_name}</h3>
        <span className="text-lg font-semibold text-slate-200">
          {formatKPIValue(result.value, result.format)}
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {result.viz_type === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => formatKPIValue(v, result.format)}
              />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => formatKPIValue(v, result.format)}
              />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
