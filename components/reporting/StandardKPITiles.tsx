'use client'

/**
 * StandardKPITiles — the 3 always-on tiles at the top of the active client
 * view. Zero-config: the new /standard-tiles endpoint auto-detects revenue
 * / calls-booked / closes / leads columns across the synced Drive folder
 * and computes lifetime values. If the user explicitly configured a
 * std_lifetime_* KPI via the catalog modal, that override wins.
 *
 * Always evaluated in lifetime mode (no timeframe params), independent of
 * the page-level TimeframePicker.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings2, Plus, AlertCircle } from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import { useBranding } from '@/components/providers/BrandingProvider'
import { STANDARD_CATALOG, type CatalogEntry } from '@/lib/reporting/kpi-catalog'
import { KPIConfigModal } from './KPIConfigModal'
import type { KPIFormat } from '@/lib/supabase/types'

interface TileResult {
  key: string
  display_name: string
  format: KPIFormat
  value: number | null
  source: 'auto' | 'override'
  detected_column?: string | null
  rows_used?: number
  source_files?: string[]
  error: string | null
}

interface Props {
  slug: string
  filenames: string[]
}

export function StandardKPITiles({ slug, filenames }: Props) {
  const branding = useBranding()
  const fmtOpts = { currency: branding.kpi_currency_code, locale: branding.kpi_currency_locale }

  const [results, setResults] = useState<TileResult[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ entry: CatalogEntry } | null>(null)

  const fetchTiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reporting/${slug}/standard-tiles`)
      const body = await res.json()
      setResults(Array.isArray(body.tiles) ? body.tiles : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchTiles()
  }, [fetchTiles])

  const byKey = useMemo(() => {
    const map = new Map<string, TileResult>()
    for (const r of results) map.set(r.key, r)
    return map
  }, [results])

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Standard (Lifetime)</h3>
          <span className="text-[10px] text-slate-600">Auto-pulled from Drive · ignores timeframe filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STANDARD_CATALOG.map((entry) => {
            const result = byKey.get(entry.catalog_key)
            const onConfigure = () => {
              // Always allow override via the catalog modal. Future enhancement:
              // route to /kpi-config when an override KPI already exists.
              setEditing({ entry })
            }
            return (
              <StandardTile
                key={entry.catalog_key}
                entry={entry}
                result={result}
                loading={loading}
                fmtOpts={fmtOpts}
                onConfigure={onConfigure}
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
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchTiles()
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
  result: TileResult | undefined
  loading: boolean
  fmtOpts: { currency: string; locale: string }
  onConfigure: () => void
}) {
  const hasValue = result && result.value != null
  const display = hasValue ? formatKPIValue(result!.value, result!.format, fmtOpts) : '—'
  const isOverride = result?.source === 'override'
  const detectedHint =
    result?.source === 'auto' && result.detected_column
      ? `Auto-detected: ${result.detected_column}`
      : null

  return (
    <div
      className={`relative rounded-xl border ${
        hasValue ? 'border-slate-700/50 bg-slate-900/60' : 'border-dashed border-slate-700 bg-slate-900/30'
      } p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-slate-400">{entry.display_name}</div>
          {isOverride && (
            <div className="text-[9px] uppercase tracking-wide text-amber-400/80 mt-0.5">Override</div>
          )}
        </div>
        <button
          onClick={onConfigure}
          className="p-1 rounded hover:bg-slate-800 text-amber-400 hover:text-amber-300 flex-shrink-0"
          aria-label={hasValue ? 'Override' : 'Configure'}
          title={hasValue ? 'Override the auto-detected column' : 'Configure manually'}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {hasValue ? (
        <div className="mt-2">
          <div className="text-2xl font-bold text-white">
            {loading ? <span className="opacity-50">…</span> : display}
          </div>
          {detectedHint && (
            <div className="mt-1 text-[10px] text-slate-500 truncate" title={detectedHint}>
              {detectedHint}
            </div>
          )}
          {result?.rows_used === 0 && (
            <div className="mt-1 text-[11px] text-amber-400">No matching rows yet.</div>
          )}
        </div>
      ) : loading ? (
        <div className="mt-2 text-2xl font-bold text-white opacity-50">…</div>
      ) : (
        <div className="mt-2">
          <div className="text-[11px] text-amber-400 flex items-center gap-1 mb-2">
            <AlertCircle className="h-3 w-3" />
            {result?.error ?? 'Not yet detected'}
          </div>
          <button
            onClick={onConfigure}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
          >
            <Plus className="h-4 w-4" /> Set column manually
          </button>
        </div>
      )}
    </div>
  )
}
