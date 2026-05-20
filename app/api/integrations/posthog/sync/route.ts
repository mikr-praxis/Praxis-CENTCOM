/**
 * Pull PostHog event counts → report_external_facts rows.
 *
 * Modes:
 *   - POST /api/integrations/posthog/sync           → sync ALL clients
 *   - POST /api/integrations/posthog/sync?slug=foo  → sync one client
 *
 * Optional overrides (query string):
 *   - event=opt_in_submitted          (default)
 *   - property=client_slug            (default — property the slug is matched against)
 *   - kind=opt_ins                    (default — what `kind` to write into facts)
 *   - lookback=90                     (default — days)
 *
 * Auth: requires Clerk session OR a `Bearer ${CRON_SECRET}` header (Vercel
 * cron sends the latter automatically when `CRON_SECRET` is set).
 *
 * Idempotent: facts are upserted on (client_id, source_type, kind, external_id)
 * where external_id = `posthog:<kind>:<YYYY-MM-DD>` so re-running the sync
 * for the same window just refreshes existing daily totals.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isIntegrationAuthorized } from '@/lib/integrations/auth'
import { fetchDailyEventCounts, getPostHogConfig } from '@/lib/integrations/posthog-server'

const SOURCE_TYPE = 'posthog'

interface ClientRow {
  id: string
  slug: string
  name: string
}

interface SyncResultClient {
  slug: string
  upserted: number
  error?: string
}

export async function POST(req: Request) {
  if (!(await isIntegrationAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = getPostHogConfig()
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          'PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in Vercel env.',
      },
      { status: 400 }
    )
  }

  const url = new URL(req.url)
  const onlySlug = url.searchParams.get('slug')
  const event = url.searchParams.get('event') || 'opt_in_submitted'
  const property = url.searchParams.get('property') || 'client_slug'
  const kind = url.searchParams.get('kind') || 'opt_ins'
  const lookback = Math.max(1, Math.min(365, Number(url.searchParams.get('lookback') || '90')))

  const supabase = createServerClient()

  let clients: ClientRow[] = []
  if (onlySlug) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, slug, name')
      .eq('slug', onlySlug)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: `Client not found: ${onlySlug}` }, { status: 404 })
    }
    clients = [data as ClientRow]
  } else {
    const { data, error } = await supabase.from('clients').select('id, slug, name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    clients = (data ?? []) as ClientRow[]
  }

  const perClient: SyncResultClient[] = []
  for (const client of clients) {
    try {
      const counts = await fetchDailyEventCounts({
        config: cfg,
        event,
        propertyKey: property,
        propertyValue: client.slug,
        lookbackDays: lookback,
      })
      if (counts.length === 0) {
        perClient.push({ slug: client.slug, upserted: 0 })
        continue
      }

      const rows = counts.map((c) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind,
        ts: `${c.day}T00:00:00Z`,
        value: c.count,
        dimensions: { event, property },
        external_id: `${SOURCE_TYPE}:${kind}:${c.day}`,
      }))

      // Upsert on the partial-unique index report_external_facts_dedup —
      // (client_id, source_type, kind, external_id) WHERE external_id IS NOT NULL.
      const { error: upsertErr } = await supabase
        .from('report_external_facts')
        .upsert(rows, { onConflict: 'client_id,source_type,kind,external_id' })
      if (upsertErr) throw new Error(upsertErr.message)

      perClient.push({ slug: client.slug, upserted: rows.length })
    } catch (e) {
      perClient.push({
        slug: client.slug,
        upserted: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const totalUpserted = perClient.reduce((a, c) => a + c.upserted, 0)
  const failures = perClient.filter((c) => c.error)
  return NextResponse.json({
    ok: failures.length === 0,
    source_type: SOURCE_TYPE,
    kind,
    event,
    property,
    lookback_days: lookback,
    clients: perClient,
    total_upserted: totalUpserted,
    failed: failures.length,
  })
}

// Vercel cron uses GET. Mirror POST so the same path works for both.
export const GET = POST
