/**
 * KPI Config — master picker. Lists every client and the KPIs they have
 * configured, with a deep link into the per-tile editor at
 * /kpi-config/[slug]/[kpiId].
 */

import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { Settings2, BarChart3, ArrowRight } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ClientWithKPIs {
  id: string
  slug: string
  name: string
  kpis: { id: string; key: string; display_name: string; viz_type: string }[]
}

export default async function KPIConfigLandingPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, name')
    .order('name')

  const clientIds = (clients ?? []).map((c) => c.id)
  const { data: kpis } = clientIds.length
    ? await supabase
        .from('report_kpis')
        .select('id, client_id, key, display_name, viz_type, display_order')
        .in('client_id', clientIds)
        .order('display_order')
    : { data: [] }

  const grouped: ClientWithKPIs[] = (clients ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    kpis: (kpis ?? [])
      .filter((k) => k.client_id === c.id)
      .map((k) => ({
        id: k.id,
        key: k.key,
        display_name: k.display_name,
        viz_type: k.viz_type,
      })),
  }))

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-amber-400" /> KPI Config
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Pick a client → tile to configure. Each tile has its own formula, viz,
          advanced options + chart options. Configure one at a time.
        </p>
      </div>

      <div className="space-y-4">
        {grouped.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-700/50 bg-slate-900">
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">{c.name}</h2>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {c.kpis.length} {c.kpis.length === 1 ? 'tile' : 'tiles'}
                </span>
              </div>
              <Link
                href={`/clients`}
                className="text-xs text-slate-400 hover:text-amber-300 inline-flex items-center gap-1"
              >
                View on /clients <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {c.kpis.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500">
                No tiles yet. Add some via the &quot;+ Add tile&quot; menu on /clients.
              </div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {c.kpis.map((k) => (
                  <li key={k.id}>
                    <Link
                      href={`/kpi-config/${c.slug}/${k.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Settings2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-white truncate">{k.display_name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-600 font-mono">
                          {k.viz_type}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono truncate flex-shrink-0">
                        {k.key}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="p-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-slate-400 text-sm">
            No clients yet — add one on /clients first.
          </div>
        )}
      </div>
    </div>
  )
}
