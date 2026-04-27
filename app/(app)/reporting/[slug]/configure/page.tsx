import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { ConfigureClient } from './configure-client'
import {
  getReportingForecastDefaultMethod,
  getReportingForecastDefaultPeriods,
} from '@/lib/reporting/config'
import type { Formula } from '@/lib/reporting/types'
import type { KPIFormat, KPIVizType, ReportKPI, ChartOptions } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function ConfigureKPIsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { userId } = await auth()
  if (!userId) return null

  const { slug } = await params
  const supabase = createServerClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, slug, name')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <Link href="/reporting" className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200 mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Reporting
        </Link>
        <div className="text-slate-400">Client not found: {slug}</div>
      </div>
    )
  }

  const { data: kpis } = await supabase
    .from('report_kpis')
    .select('*')
    .eq('client_id', client.id)
    .order('display_order')

  const { data: files } = await supabase
    .from('report_raw_files')
    .select('filename, columns')
    .eq('client_id', client.id)

  const forecastDefaultMethod = await getReportingForecastDefaultMethod()
  const forecastDefaultPeriods = await getReportingForecastDefaultPeriods()

  return (
    <ConfigureClient
      client={{ id: client.id, slug: client.slug, name: client.name }}
      forecastDefaultMethod={forecastDefaultMethod}
      forecastDefaultPeriods={forecastDefaultPeriods}
      kpis={(kpis ?? []).map((k: ReportKPI) => ({
        id: k.id,
        client_id: k.client_id,
        key: k.key,
        display_name: k.display_name,
        description: k.description,
        formula: k.formula as unknown as Formula,
        format: k.format as KPIFormat,
        target: k.target,
        viz_type: k.viz_type as KPIVizType,
        display_order: k.display_order,
        group_by_column: k.group_by_column ?? null,
        group_by_source: k.group_by_source ?? null,
        compare_to: k.compare_to ?? null,
        forecast_periods: k.forecast_periods ?? 0,
        forecast_method: k.forecast_method ?? null,
        chart_options: (k.chart_options ?? {}) as ChartOptions,
      }))}
      files={(files ?? []).map((f) => ({
        filename: f.filename,
        columns: Array.isArray(f.columns) ? (f.columns as string[]) : [],
      }))}
    />
  )
}
