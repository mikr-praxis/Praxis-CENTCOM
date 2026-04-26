'use client'

import { useCallback, useEffect, useState } from 'react'
import { TimeframePicker, computeTimeframe, type TimeframeValue } from '@/components/reporting/TimeframePicker'
import { KPICardGrid } from '@/components/reporting/KPICardGrid'
import { ChartBlock } from '@/components/reporting/ChartBlock'
import { BrandingProvider } from '@/components/providers/BrandingProvider'
import type { KPIResult } from '@/lib/reporting/types'
import type { BrandingConfig } from '@/lib/branding'

interface Props {
  token: string
  clientName: string
  branding: BrandingConfig
}

export function ShareReport({ token, clientName, branding }: Props) {
  const [timeframe, setTimeframe] = useState<TimeframeValue>(() => computeTimeframe('30d', null, null))
  const [results, setResults] = useState<KPIResult[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKpis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (timeframe.start) params.set('start', timeframe.start)
      if (timeframe.end) params.set('end', timeframe.end)
      const res = await fetch(`/api/reporting/share/${token}/kpis?${params.toString()}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to load report')
      setResults(body.results ?? [])
      setCount(body.kpi_count ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [token, timeframe.start, timeframe.end])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  return (
    <BrandingProvider value={branding}>
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">{clientName} — Report</h1>
          <span className="text-xs text-slate-500">{branding.app_footer_primary}</span>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <div className="mb-4">
          <TimeframePicker value={timeframe} onChange={setTimeframe} />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-sm">
            {error}
          </div>
        )}

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">KPIs</h2>
          {count === 0 && !loading ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-slate-400 text-sm">
              This report has no KPIs configured yet.
            </div>
          ) : (
            <KPICardGrid
              results={results.filter((r) => r.viz_type === 'card' || r.viz_type === 'pie' || r.viz_type === 'table')}
              loading={loading}
            />
          )}
        </section>

        {!loading && results.some((r) => r.viz_type === 'line' || r.viz_type === 'bar') && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">Trends</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {results
                .filter((r) => r.viz_type === 'line' || r.viz_type === 'bar')
                .map((r) => (
                  <ChartBlock key={r.kpi_id} result={r} />
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
    </BrandingProvider>
  )
}
