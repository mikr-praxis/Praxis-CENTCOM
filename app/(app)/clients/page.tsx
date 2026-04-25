import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { ClientsHome, type ClientSummary } from './clients-home'
import {
  getReportingDefaultKPICount,
  getReportingDriveParentFolderId,
  seedReportingConfigDefaults,
} from '@/lib/reporting/config'
import { listChildFolders } from '@/lib/google/drive'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  // Seed reporting config defaults on first load (idempotent)
  await seedReportingConfigDefaults(userId)
  const defaultKpiCount = await getReportingDefaultKPICount()

  // Fetch clients
  let rawClientsResult = await supabase
    .from('clients')
    .select('id, slug, name, drive_folder_id, funnel_type')
    .order('name')

  // Auto-seed Breathe for Change on first visit (idempotent — slug is unique)
  if (rawClientsResult.data && !rawClientsResult.data.find((c) => c.slug === 'breathe-for-change')) {
    await supabase
      .from('clients')
      .insert({ slug: 'breathe-for-change', name: 'Breathe for Change', funnel_type: 'call' })
    rawClientsResult = await supabase
      .from('clients')
      .select('id, slug, name, drive_folder_id, funnel_type')
      .order('name')
  }
  const { data: rawClients } = rawClientsResult

  // Auto-discover Drive folder IDs for any client missing one, by name-matching
  // against subfolders of the configured parent. Best-effort, swallows errors.
  if (rawClients) {
    const unconnected = rawClients.filter((c) => !c.drive_folder_id)
    if (unconnected.length > 0) {
      try {
        const parentId = await getReportingDriveParentFolderId()
        if (parentId) {
          const folders = await listChildFolders(parentId)
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
          let matched = false
          for (const c of unconnected) {
            const target = norm(c.name)
            const hit = folders.find((f) => norm(f.name) === target)
            if (hit) {
              await supabase.from('clients').update({ drive_folder_id: hit.id }).eq('id', c.id)
              matched = true
            }
          }
          if (matched) {
            const refreshed = await supabase
              .from('clients')
              .select('id, slug, name, drive_folder_id, funnel_type')
              .order('name')
            if (refreshed.data) rawClientsResult = refreshed
          }
        }
      } catch {
        // Drive API not enabled, parent not shared, or transient — skip silently
      }
    }
  }
  const finalClients = rawClientsResult.data ?? rawClients ?? []

  const clientList = finalClients
  if (clientList.length === 0) {
    return <ClientsHome clients={[]} defaultKpiCount={defaultKpiCount} />
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

  return <ClientsHome clients={clients} defaultKpiCount={defaultKpiCount} />
}
