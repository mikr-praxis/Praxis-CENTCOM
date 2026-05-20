/**
 * Pull Stripe paid charges → report_external_facts as daily `cash_collected`
 * + `closes` rows per client.
 *
 *   POST /api/integrations/stripe/sync                  → ALL clients
 *   POST /api/integrations/stripe/sync?slug=foo         → one client
 *   POST /api/integrations/stripe/sync?metadata_key=org_id&metadata_value_override=acme
 *
 * Idempotent: external_id = `stripe:<kind>:<YYYY-MM-DD>` upserts the day in place.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isIntegrationAuthorized } from '@/lib/integrations/auth'
import { fetchDailyCashCollected, getStripeConfig } from '@/lib/integrations/stripe-server'

const SOURCE_TYPE = 'stripe'

interface ClientRow {
  id: string
  slug: string
  name: string
}

interface SyncResultClient {
  slug: string
  upserted: number
  charges_seen: number
  error?: string
}

export async function POST(req: Request) {
  if (!(await isIntegrationAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cfg = getStripeConfig()
  if (!cfg) {
    return NextResponse.json(
      { error: 'Stripe not configured: set STRIPE_SECRET_KEY in Vercel env.' },
      { status: 400 }
    )
  }

  const url = new URL(req.url)
  const onlySlug = url.searchParams.get('slug')
  const metadataKey = url.searchParams.get('metadata_key') || 'client_slug'
  const metadataValueOverride = url.searchParams.get('metadata_value_override')
  const kind = url.searchParams.get('kind') || 'cash_collected'
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
      const dailies = await fetchDailyCashCollected({
        config: cfg,
        lookbackDays: lookback,
        metadataFilter: {
          key: metadataKey,
          value: metadataValueOverride ?? client.slug,
        },
      })
      const chargeTotal = dailies.reduce((a, d) => a + d.charge_count, 0)
      if (dailies.length === 0) {
        perClient.push({ slug: client.slug, upserted: 0, charges_seen: 0 })
        continue
      }
      const rows = dailies.map((d) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind,
        ts: `${d.day}T00:00:00Z`,
        value: d.amount,
        dimensions: {
          currency: d.currency,
          charge_count: d.charge_count,
          metadata_key: metadataKey,
          metadata_value: metadataValueOverride ?? client.slug,
        },
        external_id: `${SOURCE_TYPE}:${kind}:${d.day}`,
      }))
      const { error: upsertErr } = await supabase
        .from('report_external_facts')
        .upsert(rows, { onConflict: 'client_id,source_type,kind,external_id' })
      if (upsertErr) throw new Error(upsertErr.message)

      // Also write a per-day `closes` row using `charge_count` — same source,
      // different kind — so close_rate's numerator has typed Stripe data.
      const closesRows = dailies.map((d) => ({
        client_id: client.id,
        source_type: SOURCE_TYPE,
        kind: 'closes',
        ts: `${d.day}T00:00:00Z`,
        value: d.charge_count,
        dimensions: { currency: d.currency },
        external_id: `${SOURCE_TYPE}:closes:${d.day}`,
      }))
      const { error: closesErr } = await supabase
        .from('report_external_facts')
        .upsert(closesRows, { onConflict: 'client_id,source_type,kind,external_id' })
      if (closesErr) throw new Error(closesErr.message)

      perClient.push({
        slug: client.slug,
        upserted: rows.length + closesRows.length,
        charges_seen: chargeTotal,
      })
    } catch (e) {
      perClient.push({
        slug: client.slug,
        upserted: 0,
        charges_seen: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const totalUpserted = perClient.reduce((a, c) => a + c.upserted, 0)
  const totalCharges = perClient.reduce((a, c) => a + c.charges_seen, 0)
  const failures = perClient.filter((c) => c.error)
  return NextResponse.json({
    ok: failures.length === 0,
    source_type: SOURCE_TYPE,
    kind,
    metadata_key: metadataKey,
    lookback_days: lookback,
    clients: perClient,
    total_upserted: totalUpserted,
    total_charges_seen: totalCharges,
    failed: failures.length,
  })
}

export const GET = POST
