'use client'

/**
 * VizOptionsEditor — chart customization controls (color, axis, legend, sort,
 * top-N, stacking, etc.) that respect the chosen viz_type. Card KPIs show a
 * hint instead of options.
 *
 * Originally lived inline in /reporting/[slug]/configure/configure-client.tsx;
 * extracted here so the catalog-driven KPI config modal in /clients can reuse
 * the exact same editor.
 */

import { useBranding } from '@/components/providers/BrandingProvider'
import type { KPIVizType, ChartOptions } from '@/lib/supabase/types'

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 disabled:opacity-50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

export function VizOptionsEditor({
  vizType,
  options,
  onChange,
}: {
  vizType: KPIVizType
  options: ChartOptions
  onChange: (next: ChartOptions) => void
}) {
  const branding = useBranding()
  const accentDefault = branding.app_accent_hex
  const isTimeSeries = vizType === 'line' || vizType === 'bar' || vizType === 'area'
  const isCategorical = vizType === 'pie' || vizType === 'table'

  function patch(p: Partial<ChartOptions>) {
    onChange({ ...options, ...p })
  }

  if (vizType === 'card') {
    return (
      <p className="text-xs text-slate-500 mt-3">
        Card KPIs don&apos;t use chart options. Switch viz type to line, bar, area, pie, table, or gauge to expose customization.
      </p>
    )
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Primary color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={options.color_primary || accentDefault}
              onChange={(e) => patch({ color_primary: e.target.value })}
              className="h-9 w-16 rounded bg-slate-950/60 border border-slate-700 cursor-pointer"
            />
            <input
              type="text"
              value={options.color_primary ?? ''}
              onChange={(e) => patch({ color_primary: e.target.value || undefined })}
              placeholder={`default: ${accentDefault}`}
              className={inputCls}
            />
          </div>
        </Field>
        {(isTimeSeries || isCategorical) && (
          <Field label="Show legend">
            <select
              value={options.show_legend ? 'true' : 'false'}
              onChange={(e) => patch({ show_legend: e.target.value === 'true' })}
              className={inputCls}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
        )}
      </div>

      {(vizType === 'bar' || vizType === 'area') && (
        <Field label="Stacked (when multi-series)">
          <select
            value={options.stacked ? 'true' : 'false'}
            onChange={(e) => patch({ stacked: e.target.value === 'true' })}
            className={inputCls}
          >
            <option value="false">No (grouped)</option>
            <option value="true">Yes (stacked)</option>
          </select>
        </Field>
      )}

      {isTimeSeries && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Y-axis min (auto if blank)">
            <input
              type="number"
              value={options.y_axis_min ?? ''}
              onChange={(e) =>
                patch({ y_axis_min: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className={inputCls}
              placeholder="auto"
            />
          </Field>
          <Field label="Y-axis max (auto if blank)">
            <input
              type="number"
              value={options.y_axis_max ?? ''}
              onChange={(e) =>
                patch({ y_axis_max: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className={inputCls}
              placeholder="auto"
            />
          </Field>
        </div>
      )}

      {isCategorical && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Sort groups">
            <select
              value={options.sort_groups ?? 'value_desc'}
              onChange={(e) => patch({ sort_groups: e.target.value as ChartOptions['sort_groups'] })}
              className={inputCls}
            >
              <option value="value_desc">Value (desc)</option>
              <option value="value_asc">Value (asc)</option>
              <option value="group_asc">Group name (A→Z)</option>
            </select>
          </Field>
          <Field label="Max groups (top N)">
            <input
              type="number"
              min={2}
              max={50}
              value={options.max_groups ?? 8}
              onChange={(e) => patch({ max_groups: Number(e.target.value) || 8 })}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {vizType === 'gauge' && (
        <p className="text-[11px] text-slate-500">
          Gauge needs a Target on the KPI (above). Arc fills toward 100% of target.
        </p>
      )}

      {(vizType === 'pie' || vizType === 'table') && (
        <p className="text-[11px] text-slate-500">
          Pie + table need a Group By column on the KPI (Advanced section). Without it, the chart shows a setup hint instead of data.
        </p>
      )}
    </div>
  )
}
