/**
 * Weekly Drive sync cron — invoked by Vercel cron (see vercel.json).
 *
 * Auth: requires header `x-vercel-cron-secret` matching env var CRON_SECRET, OR
 * Vercel's standard cron `Authorization: Bearer ${CRON_SECRET}` (Vercel sets
 * this on cron requests when CRON_SECRET is configured in env).
 *
 * Iterates every client with a configured drive_folder_id and runs the
 * one-client sync. Always returns 200 with a summary so partial failures don't
 * break the schedule; per-client errors are surfaced in the response body.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncClientFolder, type SyncResult } from '@/lib/reporting/sync'
import { isWeeklySyncEnabled } from '@/lib/reporting/config'

export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const headerSecret = req.headers.get('x-vercel-cron-secret')
  const authHeader = req.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (headerSecret !== secret && bearerSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Honor the kill-switch in app_config (Hardcoded tab)
  if (!(await isWeeklySyncEnabled())) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'WEEKLY_SYNC_ENABLED is disabled in app_config',
      ran_at: new Date().toISOString(),
    })
  }

  const supabase = createServerClient()
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, slug, name, drive_folder_id')
    .not('drive_folder_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: { slug: string; result?: SyncResult; error?: string }[] = []

  for (const c of clients ?? []) {
    if (!c.drive_folder_id) continue
    try {
      const result = await syncClientFolder({
        clientId: c.id,
        folderId: c.drive_folder_id,
      })
      results.push({ slug: c.slug, result })
    } catch (e) {
      results.push({
        slug: c.slug,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    client_count: results.length,
    results,
  })
}
