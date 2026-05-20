/**
 * Pull Meta Marketing API insights → report_external_facts as daily
 * `amount_spent` + `impressions` rows per client.
 *
 *   POST /api/integrations/meta-ads/sync?slug=foo
 *   POST /api/integrations/meta-ads/sync?slug=foo&ad_account_id=12345
 *   POST /api/integrations/meta-ads/sync                    → ALL clients with stored ad account IDs
 *
 * Per-client ad account ID source order:
 *   1. ?ad_account_id= query param (override for one-off testing)
 *   2. clients.meta_ad_account_id column (production wiring)
 *
 * Until the column is added, only the override path works — sync ALL will
 * skip clients with no override and report it.
 *
 * Idempotent: external_id = `meta_ads:<kind>:<YYYY-MM-DD>` upserts the day.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isIntegrationAuthorized } from '@/lib/integrations/auth'
import { fetchDailyAdInsights, getMetaAdsConfig } from '@/lib/integrations/meta-ads-server'

const SOURCE_TYPE = 'meta_ads'

interface ClientRow {
  id: string
  slug: string
  name: string
  /** Optional: column added in a future migration (020+). Until then this
   *  field is undefined and the route falls back to the query-string override. */
  meta_ad_account_id?: string | null
}

interface SyncResultClient {
  slug: string
  upserted: number
  ad_account_id: string | null
  error?: string
}

export async function POST(req: Request) {
  if (!(await isIntegrationAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cfg = getMetaAdsConfig()
  if (!cfg) {
    return NextResponse.json(
      { error: 'Meta Ads not configured: set META_ACCESS_TOKEN in Vercel env.' },
      { status: 400 }
    )
  }

  const url = new URL(req.url)
  const onlySlug = url.searchParams.get('slug')
  const adAccountOverride = url.searchParams.get('ad_account_id')
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
    const adAccountId = adAccountOverride ?? client.meta_ad_account_id ?? null
    if (!adAccountId) {
      perClient.push({
        slug: client.slug,
        upserted: 0,
        ad_account_id: null,
        error: 'No meta_ad_account_id set (pass ?ad_account_id= or add the column).',
      })
      continue
    }
    try {
      const dailies = await fetchDailyAdInsights({
        config: cfg,
        adAccountId,
        lookbackDays: lookback,
      })
      if (dailies.length === 0) {
        perClient.push({ slug: client.slug, upserted: 0, ad_account_id: adAccountId })
        continue
      }
      // Emit two kinds per day so cpm + amount_spent both have typed data.
      const spendRows = dailies.map((d) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind: 'amount_spent',
        ts: `${d.day}T00:00:00Z`,
        value: d.spend,
        dimensions: { ad_account_id: adAccountId },
        external_id: `${SOURCE_TYPE}:amount_spent:${d.day}`,
      }))
      const imprRows = dailies.map((d) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind: 'impressions',
        ts: `${d.day}T00:00:00Z`,
        value: d.impressions,
        dimensions: { ad_account_id: adAccountId },
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
        ad_account_id: adAccountId,
      })
    } catch (e) {
      perClient.push({
        slug: client.slug,
        upserted: 0,
        ad_account_id: adAccountId,
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
