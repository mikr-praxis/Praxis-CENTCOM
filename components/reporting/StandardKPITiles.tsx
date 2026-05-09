'use client'

/**
 * StandardKPITiles — the always-on lifetime tiles at the top of the active
 * client view. Zero-config: pulls every synced Drive file, auto-detects the
 * canonical funnel columns (spend, leads, calls booked, etc.), and renders
 * 18 lifetime KPIs (volumes, costs, rates, averages) without any setup.
 *
 * Per-tile:
 *   - source 'auto'          → detected column shown as a small caption
 *   - source 'override'      → user manually configured this tile (gear → /kpi-config)
 *   - source 'unconfigured'  → at least one required canonical metric missing
 *                              from the synced files; show a Configure CTA so
 *                              the user can pick a column manually
 *
 * Always evaluated lifetime (timeframe params ignored) — independent of the
 * page-level TimeframePicker.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings2, Plus, AlertCircle, Sparkles } from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import { useBranding } from '@/components/providers/BrandingProvider'
import { STANDARD_CATALOG, getCatalogEntry, type CatalogEntry } from '@/lib/reporting/kpi-catalog'
import { KPIConfigModal } from './KPIConfigModal'
import type { KPIFormat } from '@/lib/supabase/types'
import type { CanonicalMetric } from '@/lib/reporting/auto-detect'

type StdGroup = 'volumes' | 'costs' | 'rates' | 'averages'

interface StandardTileResult {
  key: string
  display_name: string
  description: string
  format: KPIFormat
  std_group: StdGroup
  value: number | null
  rows_used: number
  source_files: string[]
  error: string | null
  source: 'override' | 'auto' | 'unconfigured'
  detected?: Partial<Record<CanonicalMetric, string>>
  missing?: CanonicalMetric[]
  kpi_id?: string
}

interface ApiResponse {
  file_count: number
  detected: Partial<Record<CanonicalMetric, string>>
  metric_labels: Record<CanonicalMetric, string>
  tiles: StandardTileResult[]
}

interface Props {
  slug: string
  filenames: string[]
}

const GROUP_LABELS: Record<StdGroup, string> = {
  volumes: 'Volumes',
  costs: 'Costs',
  rates: 'Rates',
  averages: 'Averages',
}
const GROUP_ORDER: StdGroup[] = ['volumes', 'costs', 'rates', 'averages']

export function StandardKPITiles({ slug, filenames }: Props) {
  const branding = useBranding()
  const fmtOpts = { currency: branding.kpi_currency_code, locale: branding.kpi_currency_locale }

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ entry: CatalogEntry; existingId?: string } | null>(null)

  const fetchTiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reporting/${slug}/standard-tiles`)
      const body = (await res.json()) as ApiResponse
      setData(body)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchTiles()
  }, [fetchTiles])

  // Refetch when a sync completes (the parent dispatches praxis:sync).
  useEffect(() => {
    const onSynced = () => fetchTiles()
    window.addEventListener('praxis:synced', onSynced)
    return () => window.removeEventListener('praxis:synced', onSynced)
  }, [fetchTiles])

  const grouped = useMemo(() => {
    const tiles = data?.tiles ?? []
    const map: Record<StdGroup, StandardTileResult[]> = {
      volumes: [],
      costs: [],
      rates: [],
      averages: [],
    }
    for (const t of tiles) map[t.std_group].push(t)
    return map
  }, [data?.tiles])

  const detectedCount = useMemo(
    () => Object.values(data?.detected ?? {}).filter(Boolean).length,
    [data?.detected]
  )

  return (
    <>
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-500">Standard (Lifetime)</h3>
            {data && (
              <span className="text-[10px] text-slate-600">
                {data.file_count} file{data.file_count === 1 ? '' : 's'} ·{' '}
                {detectedCount} of 10 metrics auto-detected
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-600">Ignores timeframe filter</span>
        </div>

        {GROUP_ORDER.map((group) => {
          const tiles = grouped[group]
          if (tiles.length === 0) return null
          return (
            <div key={group} className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                {GROUP_LABELS[group]}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {tiles.map((tile) => {
                  const entry = getCatalogEntry(tile.key)
                  if (!entry) return null
                  const onConfigure = () => {
                    if (tile.source === 'override' && tile.kpi_id) {
                      window.location.href = `/kpi-config/${slug}/${tile.kpi_id}`
                    } else {
                      setEditing({ entry, existingId: tile.kpi_id })
                    }
                  }
                  return (
                    <StandardTile
                      key={tile.key}
                      tile={tile}
                      labels={data?.metric_labels}
                      loading={loading}
                      fmtOpts={fmtOpts}
                      onConfigure={onConfigure}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {data && data.file_count === 0 && (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center">
            <div className="text-sm text-slate-300 font-medium">No synced files yet</div>
            <div className="text-xs text-slate-500 mt-1">
              Connect this client&apos;s Drive folder and click Sync. Tiles auto-fill once data lands.
            </div>
          </div>
        )}
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
            fetchTiles()
          }}
        />
      )}
    </>
  )
}

function StandardTile({
  tile,
  labels,
  loading,
  fmtOpts,
  onConfigure,
}: {
  tile: StandardTileResult
  labels: Record<CanonicalMetric, string> | undefined
  loading: boolean
  fmtOpts: { currency: string; locale: string }
  onConfigure: () => void
}) {
  const display = tile.value != null ? formatKPIValue(tile.value, tile.format, fmtOpts) : '—'
  const isAuto = tile.source === 'auto'
  const isUnconfigured = tile.source === 'unconfigured'

  // Caption text for auto/override tiles.
  let caption: string | null = null
  if (isAuto && tile.detected) {
    const cols = Object.values(tile.detected).filter(Boolean) as string[]
    if (cols.length === 1) caption = cols[0]
    else if (cols.length === 2) caption = `${cols[0]} / ${cols[1]}`
    else if (cols.length > 0) caption = cols.join(' · ')
  } else if (tile.source === 'override') {
    caption = 'Manual'
  }

  // Missing-metrics caption for unconfigured tiles.
  let missingText: string | null = null
  if (isUnconfigured && tile.missing && tile.missing.length > 0 && labels) {
    missingText = tile.missing.map((m) => labels[m]).join(' + ')
  }

  return (
    <div
      className={`relative rounded-xl border p-3 ${
        isUnconfigured
          ? 'border-dashed border-slate-700 bg-slate-900/30'
          : 'border-slate-700/50 bg-slate-900/60'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="text-[11px] font-medium text-slate-400 truncate" title={tile.display_name}>
          {tile.display_name}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAuto && (
            <span title="Auto-detected from your synced files">
              <Sparkles className="h-3 w-3 text-amber-400/70" />
            </span>
          )}
          <button
            onClick={onConfigure}
            className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-amber-300"
            aria-label="Configure"
            title="Override the column mapping for this tile"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isUnconfigured ? (
        <div className="mt-2">
          <button
            onClick={onConfigure}
            className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/15"
          >
            <Plus className="h-3 w-3" /> Set up
          </button>
          {missingText && (
            <div
              className="mt-1.5 text-[10px] text-slate-500 line-clamp-2"
              title={`Couldn't detect: ${missingText}`}
            >
              Need: {missingText}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1.5">
          <div className="text-xl font-bold text-white truncate" title={display}>
            {loading ? <span className="opacity-50">…</span> : display}
          </div>
          {tile.error ? (
            <div className="mt-0.5 text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {tile.error}
            </div>
          ) : tile.value != null && tile.rows_used === 0 ? (
            <div className="mt-0.5 text-[10px] text-amber-400/70">No matching rows yet.</div>
          ) : caption ? (
            <div
              className="mt-0.5 text-[10px] text-slate-500 truncate"
              title={`Source column${caption.includes('/') ? 's' : ''}: ${caption}`}
            >
              {caption}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
