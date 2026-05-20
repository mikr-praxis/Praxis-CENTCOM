/**
 * Diagnostic endpoint — what events does PostHog have? Pairs with
 * /api/integrations/posthog/sync: when a sync returns total_upserted: 0,
 * the most common cause is the configured event/property doesn't match
 * what the marketing site is actually capturing. This route lists the top
 * events and their property keys so the sync filter can be adjusted to
 * reality instead of guessing.
 *
 * Auth: Clerk session OR Bearer ${CRON_SECRET} (same as /sync).
 *
 *   POST /api/integrations/posthog/inspect           → last 30 days, top 20 events
 *   POST /api/integrations/posthog/inspect?lookback=90&limit=40
 */
import { NextResponse } from 'next/server'
import { isIntegrationAuthorized } from '@/lib/integrations/auth'
import { fetchTopEvents, getPostHogConfig } from '@/lib/integrations/posthog-server'

export async function POST(req: Request) {
  if (!(await isIntegrationAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cfg = getPostHogConfig()
  if (!cfg) {
    return NextResponse.json(
      { error: 'PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID.' },
      { status: 400 }
    )
  }
  const url = new URL(req.url)
  const lookback = Math.max(1, Math.min(365, Number(url.searchParams.get('lookback') || '30')))
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '20')))

  try {
    const events = await fetchTopEvents({ config: cfg, lookbackDays: lookback, limit })
    return NextResponse.json({
      ok: true,
      lookback_days: lookback,
      event_count: events.length,
      events,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export const GET = POST
