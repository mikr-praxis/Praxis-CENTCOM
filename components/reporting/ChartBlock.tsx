'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Legend,
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
  const opts = result.chart_options ?? {}
  const accent = opts.color_primary || branding.app_accent_hex

  const series = result.series ?? []
  const forecast = result.forecast ?? []
  const data = [
    ...series.map((p) => ({ bucket: p.bucket, actual: p.value ?? 0, forecast: null as number | null })),
    ...forecast.map((p, i) => ({
      bucket: p.bucket,
      actual: i === 0 && series.length > 0 ? (series[series.length - 1].value ?? 0) : null,
      forecast: p.value ?? null,
    })),
  ]
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

  const forecastStart = forecast.length > 0 && series.length > 0 ? series[series.length - 1].bucket : null
  const forecastEnd = forecast.length > 0 ? forecast[forecast.length - 1].bucket : null
  const yDomain: [number | string, number | string] = [
    opts.y_axis_min ?? 'auto',
    opts.y_axis_max ?? 'auto',
  ]

  const tooltipProps = {
    contentStyle: { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6 },
    labelStyle: { color: '#cbd5e1' },
    formatter: (v: unknown) => formatKPIValue(typeof v === 'number' ? v : Number(v), result.format, fmtOpts),
  }

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
              <YAxis stroke="#64748b" fontSize={10} domain={yDomain} />
              <Tooltip {...tooltipProps} />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              {opts.show_legend && <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />}
              <Bar dataKey="actual" fill={accent} stackId={opts.stacked ? 'a' : undefined} />
              {forecast.length > 0 && (
                <Bar
                  dataKey="forecast"
                  fill={accent}
                  fillOpacity={0.4}
                  stackId={opts.stacked ? 'a' : undefined}
                />
              )}
            </BarChart>
          ) : result.viz_type === 'area' ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} domain={yDomain} />
              <Tooltip {...tooltipProps} />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              {forecastStart && forecastEnd && (
                <ReferenceArea x1={forecastStart} x2={forecastEnd} fill="#6366f1" fillOpacity={0.05} />
              )}
              {opts.show_legend && <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />}
              <Area
                type="monotone"
                dataKey="actual"
                stroke={accent}
                fill={accent}
                fillOpacity={0.25}
                strokeWidth={2}
                stackId={opts.stacked ? 'a' : undefined}
              />
              {forecast.length > 0 && (
                <Area
                  type="monotone"
                  dataKey="forecast"
                  stroke={accent}
                  fill={accent}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  stackId={opts.stacked ? 'a' : undefined}
                />
              )}
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} domain={yDomain} />
              <Tooltip {...tooltipProps} />
              {result.target != null && (
                <ReferenceLine y={result.target} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              {forecastStart && forecastEnd && (
                <ReferenceArea x1={forecastStart} x2={forecastEnd} fill="#6366f1" fillOpacity={0.05} />
              )}
              {opts.show_legend && <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />}
              <Line type="monotone" dataKey="actual" stroke={accent} strokeWidth={2} dot={false} />
              {forecast.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke={accent}
                  strokeOpacity={0.7}
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
        <p className="mt-2 text-[10px] text-slate-500">
          Dashed line: {forecast.length}-period forecast
        </p>
      )}
    </div>
  )
}
