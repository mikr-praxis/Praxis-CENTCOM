/**
 * Pull HubSpot contacts → report_external_facts as daily
 * `qualified_leads` + `unqualified_leads` rows per client.
 *
 *   POST /api/integrations/hubspot/sync                  → ALL clients
 *   POST /api/integrations/hubspot/sync?slug=foo         → one client
 *   POST /api/integrations/hubspot/sync?property=org_id  → use a different property
 *
 * The HubSpot contacts being synced must carry a custom property identifying
 * the CENTCOM client (default `client_slug`). Set it in your list-add
 * automation so every new contact gets tagged.
 *
 * Idempotent: external_id = `hubspot:<kind>:<YYYY-MM-DD>` upserts the day.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isIntegrationAuthorized } from '@/lib/integrations/auth'
import { fetchDailyFunnelCounts, getHubSpotConfig } from '@/lib/integrations/hubspot-server'

const SOURCE_TYPE = 'hubspot'

interface ClientRow {
  id: string
  slug: string
  name: string
}

interface SyncResultClient {
  slug: string
  qualified_upserted: number
  unqualified_upserted: number
  error?: string
}

export async function POST(req: Request) {
  if (!(await isIntegrationAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cfg = await getHubSpotConfig()
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          'HubSpot not configured: set HUBSPOT_ACCESS_TOKEN via /config or as Vercel env.',
      },
      { status: 400 }
    )
  }

  const url = new URL(req.url)
  const onlySlug = url.searchParams.get('slug')
  const propertyKey = url.searchParams.get('property') || 'client_slug'
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
      const dailies = await fetchDailyFunnelCounts({
        config: cfg,
        lookbackDays: lookback,
        propertyKey,
        propertyValue: client.slug,
      })
      if (dailies.length === 0) {
        perClient.push({ slug: client.slug, qualified_upserted: 0, unqualified_upserted: 0 })
        continue
      }

      const qualifiedRows = dailies
        .filter((d) => d.qualified > 0)
        .map((d) => ({
          client_id: client.id,
          source_type: SOURCE_TYPE,
          kind: 'qualified_leads',
          ts: `${d.day}T00:00:00Z`,
          value: d.qualified,
          dimensions: { property: propertyKey },
          external_id: `${SOURCE_TYPE}:qualified_leads:${d.day}`,
        }))
      const unqualifiedRows = dailies
        .filter((d) => d.unqualified > 0)
        .map((d) => ({
          client_id: client.id,
          source_type: SOURCE_TYPE,
          kind: 'unqualified_leads',
          ts: `${d.day}T00:00:00Z`,
          value: d.unqualified,
          dimensions: { property: propertyKey },
          external_id: `${SOURCE_TYPE}:unqualified_leads:${d.day}`,
        }))

      for (const rows of [qualifiedRows, unqualifiedRows]) {
        if (rows.length === 0) continue
        const { error: upErr } = await supabase
          .from('report_external_facts')
          .upsert(rows, { onConflict: 'client_id,source_type,kind,external_id' })
        if (upErr) throw new Error(upErr.message)
      }
      perClient.push({
        slug: client.slug,
        qualified_upserted: qualifiedRows.length,
        unqualified_upserted: unqualifiedRows.length,
      })
    } catch (e) {
      perClient.push({
        slug: client.slug,
        qualified_upserted: 0,
        unqualified_upserted: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const totalQualified = perClient.reduce((a, c) => a + c.qualified_upserted, 0)
  const totalUnqualified = perClient.reduce((a, c) => a + c.unqualified_upserted, 0)
  const failures = perClient.filter((c) => c.error)
  return NextResponse.json({
    ok: failures.length === 0,
    source_type: SOURCE_TYPE,
    property_key: propertyKey,
    lookback_days: lookback,
    clients: perClient,
    total_upserted: totalQualified + totalUnqualified,
    total_qualified: totalQualified,
    total_unqualified: totalUnqualified,
    failed: failures.length,
  })
}

export const GET = POST
