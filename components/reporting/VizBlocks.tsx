'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts'
import { AlertCircle, Database, Settings2 } from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import type { KPIResult } from '@/lib/reporting/types'
import { useBranding } from '@/components/providers/BrandingProvider'

interface Props {
  result: KPIResult
  /** When provided, renders a Settings2 icon in the header. */
  onConfigure?: () => void
}

function ConfigButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 p-1.5 rounded text-amber-400 hover:text-amber-300 hover:bg-slate-800 z-10"
      title="Configure formula + viz"
      aria-label="Configure KPI"
    >
      <Settings2 className="h-5 w-5" />
    </button>
  )
}

function fmtOptsFromBranding(b: { kpi_currency_code: string; kpi_currency_locale: string }) {
  return { currency: b.kpi_currency_code, locale: b.kpi_currency_locale }
}

/** Generate a deterministic palette around a base hex color (lightening progressively). */
function palette(base: string, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const lightness = 0.0 + (i * 0.55) / Math.max(count - 1, 1)
    out.push(mixHexWithWhite(base, lightness))
  }
  return out
}

function mixHexWithWhite(hex: string, t: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i)
  if (!m) return hex
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`
}

/* ─────────────────────────── Pie ─────────────────────────── */

export function PieBlock({ result, onConfigure }: Props) {
  const branding = useBranding()
  const fmtOpts = fmtOptsFromBranding(branding)
  const opts = result.chart_options ?? {}
  const groups = result.groups ?? []
  const accent = opts.color_primary || branding.app_accent_hex
  const cap = Math.max(2, Math.min(20, opts.max_groups ?? 8))

  if (groups.length === 0) {
    return (
      <EmptyVizCard
        title={result.display_name}
        onConfigure={onConfigure}
        icon={<Database className="h-4 w-4" />}
        message="Pie chart needs a Group By column on the KPI. Open Configure → Advanced."
        error={result.error}
      />
    )
  }

  const data = groups
    .slice(0, cap)
    .map((g) => ({ name: g.group, value: g.value ?? 0 }))
  const colors = palette(accent, data.length)
  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900 relative">
      {onConfigure && <ConfigButton onClick={onConfigure} />}
      <div className="flex items-baseline justify-between mb-2 pr-7">
        <h3 className="text-sm font-semibold text-white truncate">{result.display_name}</h3>
        <span className="text-lg font-semibold text-slate-200">
          {formatKPIValue(result.value, result.format, fmtOpts)}
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i]} stroke="#0f172a" strokeWidth={1} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v, name) => {
                const num = typeof v === 'number' ? v : Number(v)
                const pct = total > 0 ? `${((num / total) * 100).toFixed(1)}%` : ''
                return [`${formatKPIValue(num, result.format, fmtOpts)} ${pct}`, name as string]
              }}
            />
            {opts.show_legend && <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─────────────────────────── Table ─────────────────────────── */

export function TableBlock({ result, onConfigure }: Props) {
  const branding = useBranding()
  const fmtOpts = fmtOptsFromBranding(branding)
  const opts = result.chart_options ?? {}
  const groups = result.groups ?? []
  const cap = Math.max(2, Math.min(50, opts.max_groups ?? 12))
  const total = groups.reduce((a, g) => a + (g.value ?? 0), 0)

  if (groups.length === 0) {
    return (
      <EmptyVizCard
        title={result.display_name}
        onConfigure={onConfigure}
        icon={<Database className="h-4 w-4" />}
        message="Table needs a Group By column on the KPI. Open Configure → Advanced."
        error={result.error}
      />
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900 overflow-hidden relative">
      {onConfigure && <ConfigButton onClick={onConfigure} />}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-baseline justify-between pr-12">
        <h3 className="text-sm font-semibold text-white truncate">{result.display_name}</h3>
        <span className="text-lg font-semibold text-slate-200">
          {formatKPIValue(result.value, result.format, fmtOpts)}
        </span>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/40 sticky top-0">
            <tr className="text-left text-slate-400">
              <th className="px-4 py-2 font-medium">Group</th>
              <th className="px-4 py-2 font-medium text-right">Value</th>
              <th className="px-4 py-2 font-medium text-right">Share</th>
              <th className="px-4 py-2 font-medium text-right">Rows</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, cap).map((g) => {
              const share = total > 0 ? ((g.value ?? 0) / total) * 100 : 0
              return (
                <tr key={g.group} className="border-t border-slate-800">
                  <td className="px-4 py-1.5 text-slate-200 truncate max-w-[300px]" title={g.group}>{g.group}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-slate-200">
                    {formatKPIValue(g.value, result.format, fmtOpts)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-slate-400">{share.toFixed(1)}%</td>
                  <td className="px-4 py-1.5 text-right font-mono text-slate-500">{g.rows_used.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────── Gauge ─────────────────────────── */

export function GaugeBlock({ result, onConfigure }: Props) {
  const branding = useBranding()
  const fmtOpts = fmtOptsFromBranding(branding)
  const opts = result.chart_options ?? {}
  const accent = opts.color_primary || branding.app_accent_hex

  if (result.value == null) {
    return (
      <EmptyVizCard
        title={result.display_name}
        onConfigure={onConfigure}
        icon={<AlertCircle className="h-4 w-4" />}
        message="No value to plot."
        error={result.error}
      />
    )
  }
  if (result.target == null || result.target <= 0) {
    return (
      <EmptyVizCard
        title={result.display_name}
        onConfigure={onConfigure}
        icon={<AlertCircle className="h-4 w-4" />}
        message="Gauge needs a Target on the KPI. Open Configure → set a target."
        error={result.error}
      />
    )
  }

  const pctOfTarget = (result.value / result.target) * 100
  const clamped = Math.max(0, Math.min(100, pctOfTarget))
  const data = [{ name: 'progress', value: clamped, fill: accent }]

  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900 relative">
      {onConfigure && <ConfigButton onClick={onConfigure} />}
      <div className="flex items-baseline justify-between mb-2 pr-7">
        <h3 className="text-sm font-semibold text-white truncate">{result.display_name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          target {formatKPIValue(result.target, result.format, fmtOpts)}
        </span>
      </div>
      <div className="h-44 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            startAngle={210}
            endAngle={-30}
            innerRadius="70%"
            outerRadius="100%"
            cx="50%"
            cy="60%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: '#1e293b' }} dataKey="value" cornerRadius={6} isAnimationActive={false} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
          <span className="text-2xl font-semibold text-white">
            {formatKPIValue(result.value, result.format, fmtOpts)}
          </span>
          <span
            className={
              pctOfTarget >= 100
                ? 'text-xs text-emerald-400'
                : pctOfTarget >= 80
                  ? 'text-xs text-amber-400'
                  : 'text-xs text-red-400'
            }
          >
            {pctOfTarget.toFixed(0)}% of target
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── helpers ─────────────────────────── */

function EmptyVizCard({
  title,
  icon,
  message,
  error,
  onConfigure,
}: {
  title: string
  icon: React.ReactNode
  message: string
  error: string | null
  onConfigure?: () => void
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900 relative">
      {onConfigure && <ConfigButton onClick={onConfigure} />}
      <h3 className="text-sm font-semibold text-white mb-2 pr-7">{title}</h3>
      <p className="text-xs text-slate-500 inline-flex items-start gap-1.5">
        <span className="mt-0.5 text-slate-600">{icon}</span>
        <span>{error ?? message}</span>
      </p>
    </div>
  )
}
