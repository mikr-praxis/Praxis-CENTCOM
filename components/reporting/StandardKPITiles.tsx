'use client'

/**
 * StandardKPITiles — the always-on lifetime tiles at the top of the active
 * client view.
 *
 * Mapping is AI-driven: /api/reporting/[slug]/standard-tiles asks Claude to
 * read the synced files (filename + columns + sample rows) and pick the right
 * column / formula for each canonical KPI (spend, leads, ROAS, …). Each tile
 * shows the AI's choice as a caption + a "(?)" tooltip with the rationale,
 * so the user can see exactly which file + column was used and override
 * via the gear when the AI got it wrong.
 *
 * Always evaluated lifetime (no timeframe params).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Settings2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react'
import { formatKPIValue } from '@/lib/reporting/engine'
import { useBranding } from '@/components/providers/BrandingProvider'
import {
  STANDARD_CATALOG,
  getCatalogEntry,
  type CatalogEntry,
} from '@/lib/reporting/kpi-catalog'
import { KPIConfigModal } from './KPIConfigModal'
import type { KPIFormat } from '@/lib/supabase/types'

interface TileResponse {
  key: string
  display_name: string
  format: KPIFormat
  value: number | null
  rows_used: number
  source_files: string[]
  error: string | null
  source: 'override' | 'ai' | 'unmapped'
  confidence?: 'high' | 'medium' | 'low'
  rationale?: string
  source_columns?: string[]
  kpi_id?: string
}

interface ApiResponse {
  file_count: number
  mapping_generated_at: string | null
  mapping_model: string | null
  from_cache: boolean
  tiles: TileResponse[]
}

interface Props {
  slug: string
  filenames: string[]
}

export function StandardKPITiles({ slug, filenames }: Props) {
  const branding = useBranding()
  const fmtOpts = { currency: branding.kpi_currency_code, locale: branding.kpi_currency_locale }

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [remapping, setRemapping] = useState(false)
  const [editing, setEditing] = useState<{ entry: CatalogEntry; existingId?: string } | null>(null)

  const fetchTiles = useCallback(async (force = false) => {
    if (force) setRemapping(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/reporting/${slug}/standard-tiles`, {
        method: force ? 'POST' : 'GET',
      })
      const body = (await res.json()) as ApiResponse
      setData(body)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRemapping(false)
    }
  }, [slug])

  useEffect(() => {
    fetchTiles()
  }, [fetchTiles])

  // Refetch when a sync completes — the parent dispatches 'praxis:synced'.
  useEffect(() => {
    const onSynced = () => fetchTiles()
    window.addEventListener('praxis:synced', onSynced)
    return () => window.removeEventListener('praxis:synced', onSynced)
  }, [fetchTiles])

  const tilesByKey = useMemo(() => {
    const map = new Map<string, TileResponse>()
    for (const t of data?.tiles ?? []) map.set(t.key, t)
    return map
  }, [data?.tiles])

  // Group catalog entries by std_group (volumes/costs/rates/averages); fall back
  // to a single Volumes group if entries don't carry std_group.
  const grouped = useMemo(() => {
    type Group = 'volumes' | 'costs' | 'rates' | 'averages'
    const order: Group[] = ['volumes', 'costs', 'rates', 'averages']
    const map: Record<Group, CatalogEntry[]> = {
      volumes: [],
      costs: [],
      rates: [],
      averages: [],
    }
    for (const e of STANDARD_CATALOG) {
      const g = (e as CatalogEntry & { std_group?: Group }).std_group ?? 'volumes'
      map[g].push(e)
    }
    return order.map((g) => ({ group: g, entries: map[g] })).filter((x) => x.entries.length > 0)
  }, [])

  const groupLabels: Record<string, string> = {
    volumes: 'Volumes',
    costs: 'Costs',
    rates: 'Rates',
    averages: 'Averages',
  }

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-500">Standard (Lifetime)</h3>
            {data && (
              <span className="text-[10px] text-slate-600">
                {data.file_count} file{data.file_count === 1 ? '' : 's'} ·{' '}
                {data.from_cache ? 'cached' : 'fresh'} ·{' '}
                {data.mapping_model ? `mapped by ${data.mapping_model.split('-').slice(0, 3).join('-')}` : 'no AI'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTiles(true)}
              disabled={remapping || loading || (data?.file_count ?? 0) === 0}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500 hover:text-amber-300 disabled:opacity-40"
              title="Re-run the AI mapping (forces a fresh Claude call, ignores cache)"
            >
              <RefreshCw className={`h-3 w-3 ${remapping ? 'animate-spin' : ''}`} />
              {remapping ? 'Re-mapping…' : 'Re-map'}
            </button>
            <span className="text-[10px] text-slate-600">Ignores timeframe</span>
          </div>
        </div>

        {grouped.map(({ group, entries }) => (
          <div key={group} className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
              {groupLabels[group]}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {entries.map((entry) => {
                const tile = tilesByKey.get(entry.catalog_key)
                const onConfigure = () => {
                  if (tile?.source === 'override' && tile.kpi_id) {
                    window.location.href = `/kpi-config/${slug}/${tile.kpi_id}`
                  } else {
                    setEditing({ entry, existingId: tile?.kpi_id })
                  }
                }
                return (
                  <StandardTile
                    key={entry.catalog_key}
                    entry={entry}
                    tile={tile}
                    loading={loading || remapping}
                    fmtOpts={fmtOpts}
                    onConfigure={onConfigure}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {data && data.file_count === 0 && (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center">
            <div className="text-sm text-slate-300 font-medium">No synced files yet</div>
            <div className="text-xs text-slate-500 mt-1">
              Connect this client&apos;s Drive folder and click Sync. Tiles auto-map once data lands.
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
  entry,
  tile,
  loading,
  fmtOpts,
  onConfigure,
}: {
  entry: CatalogEntry
  tile: TileResponse | undefined
  loading: boolean
  fmtOpts: { currency: string; locale: string }
  onConfigure: () => void
}) {
  const display =
    tile && tile.value != null ? formatKPIValue(tile.value, tile.format, fmtOpts) : '—'
  const isOverride = tile?.source === 'override'
  const isAI = tile?.source === 'ai'
  const isUnmapped = !tile || tile.source === 'unmapped'

  // Provenance caption (file + column the AI / override picked).
  let caption: string | null = null
  if (tile) {
    if (isOverride) caption = 'Manual'
    else if (isAI) {
      const cols = tile.source_columns ?? []
      const files = tile.source_files ?? []
      if (cols.length === 1 && files.length === 1) {
        caption = `${cols[0]} · ${files[0]}`
      } else if (cols.length > 0) {
        caption = cols.join(' / ')
      }
    }
  }

  const confidenceColor =
    tile?.confidence === 'high'
      ? 'text-emerald-400/80'
      : tile?.confidence === 'medium'
      ? 'text-amber-400/80'
      : 'text-slate-500'

  return (
    <div
      className={`relative rounded-xl border p-3 ${
        isUnmapped
          ? 'border-dashed border-slate-700 bg-slate-900/30'
          : 'border-slate-700/50 bg-slate-900/60'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-400 truncate" title={entry.display_name}>
            {entry.display_name}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAI && (
            <span title="Auto-mapped by AI from your synced files" className={confidenceColor}>
              <Sparkles className="h-3 w-3" />
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

      <div className="mt-1.5">
        <div className="text-xl font-bold text-white truncate" title={display}>
          {loading ? <span className="opacity-50">…</span> : display}
        </div>

        {tile?.error ? (
          <div className="mt-0.5 text-[10px] text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {tile.error}
          </div>
        ) : isUnmapped ? (
          <div className="mt-0.5 text-[10px] text-slate-500">
            {tile?.rationale ?? 'Not enough data — click the gear to configure manually.'}
          </div>
        ) : tile && tile.value != null && tile.rows_used === 0 ? (
          <div className="mt-0.5 text-[10px] text-amber-400/70">
            Mapped, but no matching rows.
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-1 min-w-0">
            {caption && (
              <div
                className="text-[10px] text-slate-500 truncate flex-1"
                title={caption}
              >
                {caption}
              </div>
            )}
            {isAI && tile?.rationale && (
              <span
                className="flex-shrink-0 text-slate-600 hover:text-slate-400"
                title={tile.rationale}
              >
                <Info className="h-3 w-3" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
