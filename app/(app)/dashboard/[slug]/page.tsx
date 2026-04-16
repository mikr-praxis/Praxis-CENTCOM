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

  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('*')
    .eq('client_id', client.id)
    .gte('period_date', thirteenWeeksAgo.toISOString().split('T')[0])
    .order('period_date', { ascending: true })

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
