import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { FolderOpen, FileBarChart2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReportingIndexPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  let clients: Array<{
    id: string
    slug: string
    name: string
    drive_folder_id: string | null
  }> = []
  let migrationRun = true
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, slug, name, drive_folder_id')
      .order('name')
    if (error) {
      // drive_folder_id column missing → migration 015 not run
      migrationRun = false
    } else {
      clients = data ?? []
    }
  } catch {
    migrationRun = false
  }

  // Get sync stats per client
  let fileCounts: Record<string, { count: number; lastSynced: string | null }> = {}
  if (migrationRun) {
    try {
      const { data: files } = await supabase
        .from('report_raw_files')
        .select('client_id, last_synced_at')
      for (const f of files ?? []) {
        const cur = fileCounts[f.client_id] ?? { count: 0, lastSynced: null }
        cur.count += 1
        if (f.last_synced_at && (!cur.lastSynced || f.last_synced_at > cur.lastSynced)) {
          cur.lastSynced = f.last_synced_at
        }
        fileCounts[f.client_id] = cur
      }
    } catch {
      fileCounts = {}
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileBarChart2 className="h-6 w-6 text-amber-400" />
          Reporting
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Per-client reports computed from raw data files in Google Drive.
        </p>
      </div>

      {!migrationRun && (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <p className="text-amber-300 text-sm font-medium">Migration 015 not yet run.</p>
          <p className="text-amber-200/80 text-xs mt-1">
            Run <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-200">supabase/migrations/015_reporting.sql</code> in the Supabase SQL editor to enable Reporting.
          </p>
        </div>
      )}

      {clients.length === 0 && migrationRun && (
        <div className="text-slate-400 text-sm">No clients yet. Add a client in the Clients tab first.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => {
          const stats = fileCounts[c.id]
          return (
            <Link
              key={c.id}
              href={`/reporting/${c.slug}`}
              className="block p-5 rounded-xl border border-slate-700/50 bg-slate-900 hover:bg-slate-800/50 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">{c.name}</h2>
                <FolderOpen
                  className={
                    c.drive_folder_id
                      ? 'h-5 w-5 text-emerald-400'
                      : 'h-5 w-5 text-slate-600'
                  }
                />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Drive folder</span>
                  <span className={c.drive_folder_id ? 'text-emerald-400' : 'text-slate-500'}>
                    {c.drive_folder_id ? 'Connected' : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Files synced</span>
                  <span className="text-slate-300">{stats?.count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last sync</span>
                  <span className="text-slate-300">
                    {stats?.lastSynced
                      ? new Date(stats.lastSynced).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
