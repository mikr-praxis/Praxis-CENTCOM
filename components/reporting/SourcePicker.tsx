'use client'

/**
 * Source picker — narrows the workspace to one data source.
 *
 * Drives BOTH the KPI tile filter AND the Studio Builder's data source.
 * std_lifetime_* tiles are deliberately not filtered (they explicitly span
 * every file by design).
 */
import type { SourceCatalog } from './studio-types'

interface Props {
  sources: SourceCatalog[]
  value: string | null
  onChange: (v: string | null) => void
  /** When true, render compact for the toolbar. */
  compact?: boolean
}

export function SourcePicker({ sources, value, onChange, compact }: Props) {
  if (sources.length === 0) return null
  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex items-end gap-2'}>
      {!compact && (
        <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
          Source
        </label>
      )}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white min-w-[200px]"
        aria-label="Filter by source"
      >
        <option value="">All sources</option>
        <optgroup label="Drive files">
          {sources.filter((s) => s.kind === 'drive').map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </optgroup>
        <optgroup label="Integrations">
          {sources.filter((s) => s.kind === 'external').map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
