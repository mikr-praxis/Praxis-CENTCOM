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
  ReferenceArea,
} from 'recharts'
import { formatKPIValue } from '@/lib/reporting/engine'
import type { KPIResult } from '@/lib/reporting/types'
import { useBranding } from '@/components/providers/BrandingProvider'

interface Props {
  result: KPIResult
}

export function ChartBlock({ result }: Props) {
  const branding = useBranding()
  const fmtOpts = { currency: branding.kpi_currency_code, locale: branding.kpi_currency_locale }
  const series = result.series ?? []
  const forecast = result.forecast ?? []
  const data = [
    ...series.map((p) => ({ bucket: p.bucket, actual: p.value ?? 0, forecast: null as number | null })),
    ...forecast.map((p, i) => ({
      bucket: p.bucket,
      // Bridge connection: first forecast point pulls from last actual to keep the line continuous
      actual: i === 0 && series.length > 0 ? (series[series.length - 1].value ?? 0) : null,
      forecast: p.value ?? null,
    })),
  ]
  // Adjust: when forecast exists, push the last actual into the bridge so visually the dashed line continues
  if (forecast.length > 0 && series.length > 0) {
    const last = data[series.length - 1]
    if (last) last.forecast = last.actual
  }

  const hasData = data.some((d) => (d.actual ?? 0) !== 0 || (d.forecast ?? 0) !== 0)

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

  // Forecast region for visual highlight
  const forecastStart = forecast.length > 0 && series.length > 0 ? series[series.length - 1].bucket : null
  const forecastEnd = forecast.length > 0 ? forecast[forecast.length - 1].bucket : null

  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{result.display_name}</h3>
        <span className="text-lg font-semibold text-slate-200">
          {formatKPIValue(result.value, result.format, fmtOpts)}
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
                formatter={(v) => formatKPIValue(typeof v === 'number' ? v : Number(v), result.format, fmtOpts)}
              />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              <Bar dataKey="actual" fill="#f59e0b" />
              {forecast.length > 0 && <Bar dataKey="forecast" fill="#f59e0b" fillOpacity={0.4} />}
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v) => formatKPIValue(typeof v === 'number' ? v : Number(v), result.format, fmtOpts)}
              />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              {forecastStart && forecastEnd && (
                <ReferenceArea x1={forecastStart} x2={forecastEnd} fill="#6366f1" fillOpacity={0.05} />
              )}
              <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} dot={false} />
              {forecast.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {forecast.length > 0 && (
        <p className="mt-2 text-[10px] text-violet-400/80">
          Dashed line: {forecast.length}-period forecast
        </p>
      )}
    </div>
  )
}
