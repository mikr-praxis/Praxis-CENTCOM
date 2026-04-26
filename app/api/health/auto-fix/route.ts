/**
 * Safe auto-fix actions for /health page. Each action is idempotent.
 * Schema changes and destructive operations are NOT included.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  seedReportingConfigDefaults,
  getReportingDriveParentFolderId,
  getReportingSyncNotifyChannelId,
} from '@/lib/reporting/config'
import { seedBrandingDefaults } from '@/lib/branding'
import { listChildFolders } from '@/lib/google/drive'
import { syncClientFolder, type SyncResult } from '@/lib/reporting/sync'
import { getSlackClient, getSlackWriteChannel } from '@/lib/slack'

export const maxDuration = 300

export type AutoFixAction =
  | 'seed_reporting_config'
  | 'seed_branding_config'
  | 'discover_drive_folders'
  | 'sync_all_clients'
  | 'test_slack'
  | 'connect_everything'

interface AutoFixResponse {
  ok: boolean
  action: AutoFixAction
  details?: unknown
  error?: string
}

async function discoverDriveFolders(): Promise<{ matched: number; total_unconnected: number; matches: { slug: string; name: string; folder_id: string }[] }> {
  const supabase = createServerClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, name, drive_folder_id')
  const unconnected = (clients ?? []).filter((c) => !c.drive_folder_id)
  if (unconnected.length === 0) return { matched: 0, total_unconnected: 0, matches: [] }

  const parentId = await getReportingDriveParentFolderId()
  if (!parentId) return { matched: 0, total_unconnected: unconnected.length, matches: [] }

  const folders = await listChildFolders(parentId)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const matches: { slug: string; name: string; folder_id: string }[] = []
  for (const c of unconnected) {
    const target = norm(c.name)
    const hit = folders.find((f) => norm(f.name) === target)
    if (hit) {
      await supabase.from('clients').update({ drive_folder_id: hit.id }).eq('id', c.id)
      matches.push({ slug: c.slug, name: c.name, folder_id: hit.id })
    }
  }
  return { matched: matches.length, total_unconnected: unconnected.length, matches }
}

async function syncAllClients(): Promise<{ synced: number; results: { slug: string; result?: SyncResult; error?: string }[] }> {
  const supabase = createServerClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, name, drive_folder_id')
    .not('drive_folder_id', 'is', null)
  const out: { slug: string; result?: SyncResult; error?: string }[] = []
  for (const c of clients ?? []) {
    if (!c.drive_folder_id) continue
    try {
      const result = await syncClientFolder({ clientId: c.id, folderId: c.drive_folder_id })
      out.push({ slug: c.slug, result })
    } catch (e) {
      out.push({ slug: c.slug, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return { synced: out.filter((r) => r.result).length, results: out }
}

async function testSlack(): Promise<{ posted: boolean; channel: string; ts?: string; error?: string }> {
  const notifyChannel = await getReportingSyncNotifyChannelId()
  const writeChannel = await getSlackWriteChannel()
  const channel = notifyChannel ?? writeChannel.id
  try {
    const client = await getSlackClient()
    const res = await client.chat.postMessage({
      channel,
      text: ':wave: CentCom health check — Slack connection is working.',
    })
    if (res.ok) return { posted: true, channel, ts: res.ts ?? undefined }
    return { posted: false, channel, error: res.error ?? 'unknown' }
  } catch (e) {
    return { posted: false, channel, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: AutoFixAction }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    switch (body.action) {
      case 'seed_reporting_config':
        await seedReportingConfigDefaults(userId)
        return NextResponse.json<AutoFixResponse>({ ok: true, action: 'seed_reporting_config' })

      case 'seed_branding_config':
        await seedBrandingDefaults(userId)
        return NextResponse.json<AutoFixResponse>({ ok: true, action: 'seed_branding_config' })

      case 'discover_drive_folders': {
        const details = await discoverDriveFolders()
        return NextResponse.json<AutoFixResponse>({ ok: true, action: 'discover_drive_folders', details })
      }

      case 'sync_all_clients': {
        const details = await syncAllClients()
        return NextResponse.json<AutoFixResponse>({ ok: true, action: 'sync_all_clients', details })
      }

      case 'test_slack': {
        const details = await testSlack()
        return NextResponse.json<AutoFixResponse>({
          ok: details.posted,
          action: 'test_slack',
          details,
          ...(details.error ? { error: details.error } : {}),
        })
      }

      case 'connect_everything': {
        // Run all idempotent actions in sequence. Return aggregated results.
        const results: Record<string, unknown> = {}
        try {
          await seedReportingConfigDefaults(userId)
          results.seed_reporting_config = { ok: true }
        } catch (e) {
          results.seed_reporting_config = { ok: false, error: e instanceof Error ? e.message : 'failed' }
        }
        try {
          await seedBrandingDefaults(userId)
          results.seed_branding_config = { ok: true }
        } catch (e) {
          results.seed_branding_config = { ok: false, error: e instanceof Error ? e.message : 'failed' }
        }
        try {
          results.discover_drive_folders = await discoverDriveFolders()
        } catch (e) {
          results.discover_drive_folders = { ok: false, error: e instanceof Error ? e.message : 'failed' }
        }
        try {
          results.sync_all_clients = await syncAllClients()
        } catch (e) {
          results.sync_all_clients = { ok: false, error: e instanceof Error ? e.message : 'failed' }
        }
        return NextResponse.json<AutoFixResponse>({ ok: true, action: 'connect_everything', details: results })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
