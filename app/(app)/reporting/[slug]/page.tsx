import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ReportingClient } from './reporting-client'

export const dynamic = 'force-dynamic'

export default async function ClientReportPage({
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
    .select('id, slug, name, drive_folder_id, funnel_type')
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

  // Pull cached files (M2 will populate these)
  const { data: rawFiles } = await supabase
    .from('report_raw_files')
    .select('id, drive_file_id, filename, mime_type, modified_time, last_synced_at, row_count, columns')
    .eq('client_id', client.id)
    .order('modified_time', { ascending: false })

  return (
    <ReportingClient
      client={{
        id: client.id,
        slug: client.slug,
        name: client.name,
        drive_folder_id: client.drive_folder_id,
      }}
      rawFiles={(rawFiles ?? []).map((f) => ({
        id: f.id,
        drive_file_id: f.drive_file_id,
        filename: f.filename,
        mime_type: f.mime_type,
        modified_time: f.modified_time,
        last_synced_at: f.last_synced_at,
        row_count: f.row_count ?? 0,
        columns: Array.isArray(f.columns) ? (f.columns as string[]) : [],
      }))}
      readOnly={false}
    />
  )
}
