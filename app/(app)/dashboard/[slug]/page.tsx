import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { getMetricsForFunnel, getStagesForFunnel, getBenchmarksForFunnel, getKPIKeysForFunnel } from '@/lib/metrics'
import type { FunnelType, MetricSnapshot } from '@/lib/metrics/types'
import { ClientDashboard } from './client-dashboard'

export const dynamic = 'force-dynamic'

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { userId } = await auth()
  if (!userId) return null

  const { slug } = await params
  const supabase = createServerClient()

  // Get client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .single()

  if (clientErr || !client) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Client not found: {slug}</p>
      </div>
    )
  }

  const funnelType = client.funnel_type as FunnelType

  // Get latest snapshots (last 13 weeks)
  const thirteenWeeksAgo = new Date()
  thirteenWeeksAgo.setDate(thirteenWeeksAgo.getDate() - 91)

  let { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('*')
    .eq('client_id', client.id)
    .gte('period_date', thirteenWeeksAgo.toISOString().split('T')[0])
    .order('period_date', { ascending: true })

  // Auto-seed sample data for Mashore if no snapshots exist
  if ((!snapshots || snapshots.length === 0) && slug === 'mashore') {
    const sampleWeeks = [
      { date: '2025-01-06', leads: 320, booked: 42, showed: 28, closes: 8, cash: 32000, spend: 4200 },
      { date: '2025-01-13', leads: 285, booked: 38, showed: 27, closes: 9, cash: 36000, spend: 3900 },
      { date: '2025-01-20', leads: 350, booked: 48, showed: 31, closes: 11, cash: 44000, spend: 4500 },
      { date: '2025-01-27', leads: 310, booked: 40, showed: 26, closes: 7, cash: 28000, spend: 4100 },
      { date: '2025-02-03', leads: 375, booked: 52, showed: 36, closes: 12, cash: 48000, spend: 4800 },
      { date: '2025-02-10', leads: 340, booked: 45, showed: 32, closes: 10, cash: 40000, spend: 4300 },
      { date: '2025-02-17', leads: 290, booked: 35, showed: 24, closes: 8, cash: 32000, spend: 3800 },
      { date: '2025-02-24', leads: 365, booked: 50, showed: 35, closes: 13, cash: 52000, spend: 4600 },
      { date: '2025-03-03', leads: 395, booked: 55, showed: 38, closes: 14, cash: 56000, spend: 5000 },
      { date: '2025-03-10', leads: 410, booked: 58, showed: 41, closes: 15, cash: 60000, spend: 5200 },
      { date: '2025-03-17', leads: 380, booked: 51, showed: 34, closes: 11, cash: 44000, spend: 4700 },
      { date: '2025-03-24', leads: 425, booked: 60, showed: 43, closes: 16, cash: 64000, spend: 5400 },
    ]
    const rows: Array<{
      client_id: string; metric_key: string; metric_value: number;
      period_date: string; period_type: 'day' | 'week' | 'month'; confidence: 'direct' | 'derived' | 'estimated';
    }> = []
    for (const w of sampleWeeks) {
      const d = (k: string, v: number) => ({ client_id: client.id, metric_key: k, metric_value: v, period_date: w.date, period_type: 'week' as const, confidence: 'direct' as const })
      const dr = (k: string, v: number) => ({ client_id: client.id, metric_key: k, metric_value: Math.round(v * 1000) / 1000, period_date: w.date, period_type: 'week' as const, confidence: 'derived' as const })
      rows.push(d('leads', w.leads), d('calls_booked', w.booked), d('calls_showed', w.showed), d('closes', w.closes), d('cash_collected', w.cash), d('ad_spend', w.spend))
      rows.push(dr('show_rate', w.showed / w.booked), dr('close_rate', w.closes / w.showed), dr('average_order_value', w.cash / w.closes), dr('cost_per_lead', w.spend / w.leads))
    }
    await supabase.from('metric_snapshots').upsert(rows, { onConflict: 'client_id,metric_key,period_date,period_type' })
    // Re-read
    const refreshed = await supabase.from('metric_snapshots').select('*').eq('client_id', client.id).order('period_date', { ascending: true })
    snapshots = refreshed.data
  }

  // Get data sources to check mapping status
  const { data: dataSources } = await supabase
    .from('data_sources')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  // Get events
  const { data: events } = await supabase
    .from('client_events')
    .select('*')
    .eq('client_id', client.id)
    .order('event_date', { ascending: true })

  const metrics = getMetricsForFunnel(funnelType)
  const stages = getStagesForFunnel(funnelType)
  const benchmarks = getBenchmarksForFunnel(funnelType)
  const kpiKeys = getKPIKeysForFunnel(funnelType)

  return (
    <ClientDashboard
      client={{
        id: client.id,
        slug: client.slug,
        name: client.name,
        funnel_type: funnelType,
        funnel_config: client.funnel_config as Record<string, unknown>,
      }}
      snapshots={(snapshots || []) as MetricSnapshot[]}
      dataSources={dataSources || []}
      events={events || []}
      metrics={metrics}
      stages={stages}
      benchmarks={benchmarks}
      kpiKeys={kpiKeys}
    />
  )
}
