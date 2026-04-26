/**
 * Weekly Drive sync cron — invoked by Vercel cron (see vercel.json).
 *
 * Schedule policy: vercel.json fires this DAILY at 03:00 UTC (the only schedule
 * the Hobby plan reliably allows). Inside the route we gate on app_config:
 *
 *   WEEKLY_SYNC_DAY_OF_WEEK (0–6, Sun=0) and WEEKLY_SYNC_HOUR_UTC (0–23)
 *
 * If the current invocation isn't the configured slot, we 200-skip without
 * doing work. This means an admin can change the active sync day/time from
 * /hardcoded without touching vercel.json or redeploying.
 *
 * Auth: requires header `x-vercel-cron-secret` matching env var CRON_SECRET, OR
 * Vercel's standard cron `Authorization: Bearer ${CRON_SECRET}` (Vercel sets
 * this on cron requests when CRON_SECRET is configured in env).
 *
 * `?force=1` query param bypasses the slot gate (still requires the secret) so
 * you can trigger an out-of-cycle sync via curl or the /health "Connect
 * everything" path.
 *
 * Always returns 200 with a summary so partial failures don't break the
 * schedule; per-client errors are surfaced in the response body.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncClientFolder, type SyncResult } from '@/lib/reporting/sync'
import {
  isWeeklySyncEnabled,
  getWeeklySyncDayOfWeek,
  getWeeklySyncHourUtc,
} from '@/lib/reporting/config'
import { notifySyncComplete } from '@/lib/reporting/notify'

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

  // Slot gate: cron fires daily at 03:00 UTC. Only proceed if the configured
  // day-of-week and hour match. ?force=1 bypasses for ad-hoc triggers.
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true'
  if (!force) {
    const now = new Date()
    const currentDow = now.getUTCDay()
    const currentHour = now.getUTCHours()
    const targetDow = await getWeeklySyncDayOfWeek()
    const targetHour = await getWeeklySyncHourUtc()
    if (currentDow !== targetDow || currentHour !== targetHour) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `Not the configured slot (now: dow=${currentDow} hour=${currentHour}; target: dow=${targetDow} hour=${targetHour})`,
        ran_at: now.toISOString(),
      })
    }
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
  const successResults: SyncResult[] = []
  const topLevelErrors: { slug: string; error: string }[] = []

  for (const c of clients ?? []) {
    if (!c.drive_folder_id) continue
    try {
      const result = await syncClientFolder({
        clientId: c.id,
        folderId: c.drive_folder_id,
      })
      results.push({ slug: c.slug, result })
      successResults.push(result)
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      results.push({ slug: c.slug, error })
      topLevelErrors.push({ slug: c.slug, error })
    }
  }

  // Best-effort Slack notification (no-op if REPORTING_SYNC_NOTIFY_CHANNEL_ID unset)
  await notifySyncComplete({ results: successResults, topLevelErrors })

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    client_count: results.length,
    results,
  })
}
