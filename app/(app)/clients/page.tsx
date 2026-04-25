import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { ClientsHome, type ClientSummary } from './clients-home'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  // Fetch clients
  const { data: rawClients } = await supabase
    .from('clients')
    .select('id, slug, name, drive_folder_id, funnel_type')
    .order('name')

  const clientList = rawClients ?? []
  if (clientList.length === 0) {
    return <ClientsHome clients={[]} />
  }

  // Aggregate file + KPI counts per client
  const ids = clientList.map((c) => c.id)

  const fileMap: Record<string, { count: number; lastSynced: string | null; filenames: string[] }> = {}
  try {
    const { data: files } = await supabase
      .from('report_raw_files')
      .select('client_id, filename, last_synced_at')
      .in('client_id', ids)
    for (const f of files ?? []) {
      const cur = fileMap[f.client_id] ?? { count: 0, lastSynced: null, filenames: [] }
      cur.count += 1
      cur.filenames.push(f.filename)
      if (f.last_synced_at && (!cur.lastSynced || f.last_synced_at > cur.lastSynced)) {
        cur.lastSynced = f.last_synced_at
      }
      fileMap[f.client_id] = cur
    }
  } catch {
    // table may not exist if migration 015 hasn't run
  }

  const kpiMap: Record<string, number> = {}
  try {
    const { data: kpis } = await supabase
      .from('report_kpis')
      .select('client_id')
      .in('client_id', ids)
    for (const k of kpis ?? []) {
      if (k.client_id) kpiMap[k.client_id] = (kpiMap[k.client_id] ?? 0) + 1
    }
  } catch {
    /* ignore */
  }

  const clients: ClientSummary[] = clientList.map((c) => {
    const files = fileMap[c.id] ?? { count: 0, lastSynced: null, filenames: [] }
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      drive_folder_id: c.drive_folder_id,
      funnel_type: c.funnel_type,
      file_count: files.count,
      last_synced: files.lastSynced,
      filenames: files.filenames,
      kpi_count: kpiMap[c.id] ?? 0,
    }
  })

  return <ClientsHome clients={clients} />
}
