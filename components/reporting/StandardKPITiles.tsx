'use client'

/**
 * StandardKPITiles — the 3 always-on tiles at the top of the active client
 * view. Configured per-client (formula stored in report_kpis with key
 * `std_lifetime_*`), but always evaluated in lifetime mode (no timeframe
 * params), independent of the page-level TimeframePicker.
 *
 * Each tile is either:
 *   - configured → shows the lifetime value
 *   - unconfigured → shows a "Configure" CTA that opens KPIConfigModal
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings2, Plus, AlertCircle } from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import { useBranding } from '@/components/providers/BrandingProvider'
import { STANDARD_CATALOG, type CatalogEntry } from '@/lib/reporting/kpi-catalog'
import { KPIConfigModal } from './KPIConfigModal'
import type { KPIResult } from '@/lib/reporting/types'

interface Props {
  slug: string
  filenames: string[]
}

export function StandardKPITiles({ slug, filenames }: Props) {
  const branding = useBranding()
  const fmtOpts = { currency: branding.kpi_currency_code, locale: branding.kpi_currency_locale }

  const [results, setResults] = useState<KPIResult[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ entry: CatalogEntry; existingId?: string } | null>(null)

  const fetchLifetime = useCallback(async () => {
    setLoading(true)
    try {
      // No start/end → engine treats timeframe as null (lifetime).
      const res = await fetch(`/api/reporting/${slug}/kpis`)
      const body = await res.json()
      const all: KPIResult[] = Array.isArray(body.results) ? body.results : []
      setResults(all.filter((r) => STANDARD_CATALOG.some((c) => c.catalog_key === r.key)))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchLifetime()
  }, [fetchLifetime])

  const byKey = useMemo(() => {
    const map = new Map<string, KPIResult>()
    for (const r of results) map.set(r.key, r)
    return map
  }, [results])

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Standard (Lifetime)</h3>
          <span className="text-[10px] text-slate-600">Ignores timeframe filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STANDARD_CATALOG.map((entry) => {
            const result = byKey.get(entry.catalog_key)
            return (
              <StandardTile
                key={entry.catalog_key}
                entry={entry}
                result={result}
                loading={loading}
                fmtOpts={fmtOpts}
                onConfigure={() => setEditing({ entry, existingId: result?.kpi_id })}
              />
            )
          })}
        </div>
      </div>
      {editing && (
        <KPIConfigModal
          slug={slug}
          entry={editing.entry}
          filenames={filenames}
          existingKpiId={editing.existingId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchLifetime()
          }}
        />
      )}
    </>
  )
}

function StandardTile({
  entry,
  result,
  loading,
  fmtOpts,
  onConfigure,
}: {
  entry: CatalogEntry
  result: KPIResult | undefined
  loading: boolean
  fmtOpts: { currency: string; locale: string }
  onConfigure: () => void
}) {
  const configured = !!result
  const display = result ? formatKPIValue(result.value, result.format, fmtOpts) : '—'

  return (
    <div
      className={`relative rounded-xl border ${
        configured ? 'border-slate-700/50 bg-slate-900/60' : 'border-dashed border-slate-700 bg-slate-900/30'
      } p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-slate-400">{entry.display_name}</div>
        <button
          onClick={onConfigure}
          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-amber-300 flex-shrink-0"
          aria-label={configured ? 'Edit' : 'Configure'}
          title={configured ? 'Edit mapping' : 'Configure'}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {configured ? (
        <div className="mt-2">
          <div className="text-2xl font-bold text-white">
            {loading ? <span className="opacity-50">…</span> : display}
          </div>
          {result?.error && (
            <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {result.error}
            </div>
          )}
          {!result?.error && result && result.rows_used === 0 && (
            <div className="mt-1 text-[11px] text-amber-400">No matching rows yet.</div>
          )}
        </div>
      ) : (
        <button
          onClick={onConfigure}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
        >
          <Plus className="h-4 w-4" /> Configure
        </button>
      )}
    </div>
  )
}
