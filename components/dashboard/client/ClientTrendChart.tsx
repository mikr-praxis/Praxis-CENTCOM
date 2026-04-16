'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { MetricType } from '@/lib/metrics/types'
import { formatMetricValue } from '@/lib/metrics'

interface TrendDataPoint {
  date: string
  value: number
  confidence: string
}

interface ClientTrendChartProps {
  metricKey: string
  label: string
  data: TrendDataPoint[]
  format: MetricType
  benchmark?: number
}

export function ClientTrendChart({ label, data, format, benchmark }: ClientTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <p className="text-sm text-slate-400">{label} — No data yet</p>
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.value,
  }))

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">{label}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatMetricValue(Number(v), format)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                fontSize: 12,
              }}
              formatter={(value) => [formatMetricValue(Number(value), format), label]}
            />
            {benchmark !== undefined && (
              <ReferenceLine
                y={benchmark}
                stroke="#6366f1"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
