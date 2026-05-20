/**
 * Server-side Stripe helper. Pulls paid charges via /v1/charges, aggregates
 * by UTC day, returns one row per day for upsert into report_external_facts.
 *
 * Required env vars (server-only — never NEXT_PUBLIC_):
 *   - STRIPE_SECRET_KEY  Account secret key (sk_live_… or sk_test_…).
 *
 * Per-client routing: Stripe charges aren't natively scoped to a CENTCOM
 * client. The sync route uses metadata attribution — only counts a charge
 * whose `metadata.client_slug` (or a configurable key) matches the slug
 * being synced. The checkout flow needs to set this:
 *
 *   stripe.checkout.sessions.create({ ..., metadata: { client_slug: 'foo' } })
 *
 * Refunds: subtracted on the day of the original charge. For "cash collected
 * on refund date" semantics we'd need /v1/refunds — defer until needed.
 */

const DEFAULT_HOST = 'https://api.stripe.com'

export interface StripeConfig {
  secretKey: string
  host: string
}

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  return { secretKey, host: DEFAULT_HOST }
}

export function isStripeConfigured(): boolean {
  return getStripeConfig() !== null
}

interface StripeCharge {
  id: string
  amount: number
  amount_refunded: number
  currency: string
  created: number
  paid: boolean
  status: string
  metadata: Record<string, string> | null
}

interface StripeListResponse {
  object: 'list'
  data: StripeCharge[]
  has_more: boolean
}

async function listCharges(
  cfg: StripeConfig,
  args: { gteUnix: number; lteUnix: number; startingAfter?: string }
): Promise<StripeListResponse> {
  const params = new URLSearchParams()
  params.set('created[gte]', String(args.gteUnix))
  params.set('created[lte]', String(args.lteUnix))
  params.set('limit', '100')
  if (args.startingAfter) params.set('starting_after', args.startingAfter)
  const url = `${cfg.host}/v1/charges?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      'Stripe-Version': '2024-06-20',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Stripe charges list failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return (await res.json()) as StripeListResponse
}

export interface DailyAmount {
  /** ISO date 'YYYY-MM-DD' (UTC). */
  day: string
  /** Net cash collected this day (paid charges minus refunded portion), in major units. */
  amount: number
  /** Stripe currency code (e.g. 'usd'). All daily totals in one call share a currency. */
  currency: string
  /** Number of paid charges that contributed. */
  charge_count: number
}

export async function fetchDailyCashCollected(args: {
  config: StripeConfig
  lookbackDays: number
  metadataFilter?: { key: string; value: string }
}): Promise<DailyAmount[]> {
  const { config, lookbackDays, metadataFilter } = args
  const days = Math.max(1, Math.min(365, Math.floor(lookbackDays)))
  const nowUnix = Math.floor(Date.now() / 1000)
  const gteUnix = nowUnix - days * 24 * 60 * 60

  // Aggregate as we paginate to bound peak memory.
  const totals = new Map<string, { amount: number; currency: string; count: number }>()
  let cursor: string | undefined

  // 200 pages × 100 charges = 20k charge ceiling — way more than 90 days
  // would ever realistically need; we exit early on `has_more: false`.
  for (let page = 0; page < 200; page++) {
    const list = await listCharges(config, { gteUnix, lteUnix: nowUnix, startingAfter: cursor })
    for (const ch of list.data) {
      if (!ch.paid) continue
      if (ch.status !== 'succeeded') continue
      if (metadataFilter) {
        if (!ch.metadata || ch.metadata[metadataFilter.key] !== metadataFilter.value) continue
      }
      const day = new Date(ch.created * 1000).toISOString().slice(0, 10)
      const net = (ch.amount - (ch.amount_refunded ?? 0)) / 100
      const existing = totals.get(day)
      if (existing) {
        existing.amount += net
        existing.count += 1
      } else {
        totals.set(day, { amount: net, currency: ch.currency, count: 1 })
      }
    }
    if (!list.has_more || list.data.length === 0) break
    cursor = list.data[list.data.length - 1].id
  }

  return Array.from(totals.entries())
    .map(([day, agg]) => ({
      day,
      amount: Math.round(agg.amount * 100) / 100,
      currency: agg.currency,
      charge_count: agg.count,
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
}
