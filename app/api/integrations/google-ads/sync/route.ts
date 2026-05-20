/**
 * Pull Google Ads insights → report_external_facts as daily `amount_spent`
 * + `impressions` rows per client (provider source_type = 'google_ads').
 *
 *   POST /api/integrations/google-ads/sync?slug=foo&customer_id=1234567890
 *   POST /api/integrations/google-ads/sync                  → ALL clients
 *
 * Per-client customer id source order:
 *   1. ?customer_id= query param (override for one-off testing)
 *   2. clients.google_ads_customer_id column (future migration)
 *
 * Idempotent: external_id = `google_ads:<kind>:<YYYY-MM-DD>` upserts the day.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isIntegrationAuthorized } from '@/lib/integrations/auth'
import { fetchDailyAdInsights, getGoogleAdsConfig } from '@/lib/integrations/google-ads-server'

const SOURCE_TYPE = 'google_ads'

interface ClientRow {
  id: string
  slug: string
  name: string
  google_ads_customer_id?: string | null
}

interface SyncResultClient {
  slug: string
  upserted: number
  customer_id: string | null
  error?: string
}

export async function POST(req: Request) {
  if (!(await isIntegrationAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cfg = getGoogleAdsConfig()
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          'Google Ads not configured: set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID.',
      },
      { status: 400 }
    )
  }

  const url = new URL(req.url)
  const onlySlug = url.searchParams.get('slug')
  const customerIdOverride = url.searchParams.get('customer_id')
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
    const customerId = customerIdOverride ?? client.google_ads_customer_id ?? null
    if (!customerId) {
      perClient.push({
        slug: client.slug,
        upserted: 0,
        customer_id: null,
        error: 'No google_ads_customer_id set (pass ?customer_id= or add the column).',
      })
      continue
    }
    try {
      const dailies = await fetchDailyAdInsights({
        config: cfg,
        customerId,
        lookbackDays: lookback,
      })
      if (dailies.length === 0) {
        perClient.push({ slug: client.slug, upserted: 0, customer_id: customerId })
        continue
      }
      const spendRows = dailies.map((d) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind: 'amount_spent',
        ts: `${d.day}T00:00:00Z`,
        value: d.spend,
        dimensions: { customer_id: customerId },
        external_id: `${SOURCE_TYPE}:amount_spent:${d.day}`,
      }))
      const imprRows = dailies.map((d) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind: 'impressions',
        ts: `${d.day}T00:00:00Z`,
        value: d.impressions,
        dimensions: { customer_id: customerId },
        external_id: `${SOURCE_TYPE}:impressions:${d.day}`,
      }))
      for (const rows of [spendRows, imprRows]) {
        const { error: upErr } = await supabase
          .from('report_external_facts')
          .upsert(rows, { onConflict: 'client_id,source_type,kind,external_id' })
        if (upErr) throw new Error(upErr.message)
      }
      perClient.push({
        slug: client.slug,
        upserted: spendRows.length + imprRows.length,
        customer_id: customerId,
      })
    } catch (e) {
      perClient.push({
        slug: client.slug,
        upserted: 0,
        customer_id: customerId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const totalUpserted = perClient.reduce((a, c) => a + c.upserted, 0)
  const failures = perClient.filter((c) => c.error)
  return NextResponse.json({
    ok: failures.length === 0,
    source_type: SOURCE_TYPE,
    lookback_days: lookback,
    clients: perClient,
    total_upserted: totalUpserted,
    failed: failures.length,
  })
}

export const GET = POST
