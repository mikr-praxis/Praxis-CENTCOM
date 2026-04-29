'use client'

/**
 * AddKPITileMenu — "+ Add tile" dropdown that lets the user pick a curated
 * KPI from the catalog to add to the active client. Opens KPIConfigModal
 * pre-loaded with the chosen catalog entry's input slots.
 *
 * Standard (`std_*`) entries are excluded — those have their own dedicated
 * row at the top of the dashboard.
 */

import { useEffect, useRef, useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { CUSTOMIZABLE_CATALOG, type CatalogEntry } from '@/lib/reporting/kpi-catalog'
import { KPIConfigModal } from './KPIConfigModal'

interface Props {
  slug: string
  filenames: string[]
  /** Set of catalog_keys already added for this client — those entries get a "Added" badge. */
  existingKeys: Set<string>
  onAdded: () => void
}

const CATEGORY_LABELS: Record<CatalogEntry['category'], string> = {
  standard: 'Standard',
  paid_media: 'Paid media',
  funnel: 'Funnel',
  sales: 'Sales',
}

export function AddKPITileMenu({ slug, filenames, existingKeys, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<CatalogEntry | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Group by category.
  const grouped = new Map<CatalogEntry['category'], CatalogEntry[]>()
  for (const e of CUSTOMIZABLE_CATALOG) {
    const list = grouped.get(e.category) ?? []
    list.push(e)
    grouped.set(e.category, list)
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={filenames.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title={filenames.length === 0 ? 'Sync Drive files first' : 'Add a KPI tile'}
        >
          <Plus className="h-4 w-4" />
          Add tile
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-80 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-30">
            <div className="px-3 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
              Catalog
            </div>
            {Array.from(grouped.entries()).map(([cat, entries]) => (
              <div key={cat} className="py-1">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-600">
                  {CATEGORY_LABELS[cat]}
                </div>
                {entries.map((entry) => {
                  const already = existingKeys.has(entry.catalog_key)
                  return (
                    <button
                      key={entry.catalog_key}
                      onClick={() => {
                        setOpen(false)
                        setPicked(entry)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800/60 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white">{entry.display_name}</span>
                        {already && (
                          <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                            added
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {entry.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {picked && (
        <KPIConfigModal
          slug={slug}
          entry={picked}
          filenames={filenames}
          onClose={() => setPicked(null)}
          onSaved={() => {
            setPicked(null)
            onAdded()
          }}
        />
      )}
    </>
  )
}
