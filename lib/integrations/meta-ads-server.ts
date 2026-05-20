/**
 * Meta Marketing API helper. Pulls daily ad insights (spend + impressions)
 * for one ad account so the engine can compute `amount_spent`, `cpm`, and
 * `total_blended_cost` (in combination with other providers).
 *
 * Required env vars (server-only):
 *   - META_ACCESS_TOKEN  Long-lived user token, Marketing API scope.
 *
 * Per-client routing: one ad account per client. Stored on
 * clients.meta_ad_account_id (text column — added in migration 020 when
 * this provider's sync runs for real). For v0, also accepts an override via
 * the sync route's ?ad_account_id= query string.
 *
 * Endpoint:
 *   GET https://graph.facebook.com/v18.0/act_<account_id>/insights
 *     ?fields=spend,impressions
 *     &level=account
 *     &time_increment=1
 *     &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
 *     &access_token=<token>
 *
 * Response: { data: [{ date_start, date_stop, spend, impressions }] }
 */

const GRAPH_HOST = 'https://graph.facebook.com'
const API_VERSION = 'v18.0'

export interface MetaAdsConfig {
  accessToken: string
}

export function getMetaAdsConfig(): MetaAdsConfig | null {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return null
  return { accessToken }
}

export function isMetaAdsConfigured(): boolean {
  return getMetaAdsConfig() !== null
}

interface MetaInsightRow {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
}

interface MetaInsightsResponse {
  data: MetaInsightRow[]
  paging?: { next?: string }
}

export interface DailyAdInsight {
  /** ISO date 'YYYY-MM-DD' (Meta's account timezone — usually UTC). */
  day: string
  spend: number
  impressions: number
}

export async function fetchDailyAdInsights(args: {
  config: MetaAdsConfig
  adAccountId: string
  lookbackDays: number
}): Promise<DailyAdInsight[]> {
  const { config, adAccountId, lookbackDays } = args
  const days = Math.max(1, Math.min(365, Math.floor(lookbackDays)))
  // Defend against injection — ad account IDs are numeric.
  if (!/^\d+$/.test(adAccountId)) {
    throw new Error(`Invalid Meta ad account id: ${adAccountId}`)
  }
  const now = new Date()
  const until = now.toISOString().slice(0, 10)
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const params = new URLSearchParams({
    fields: 'spend,impressions',
    level: 'account',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    access_token: config.accessToken,
  })

  const out: DailyAdInsight[] = []
  let url: string | undefined = `${GRAPH_HOST}/${API_VERSION}/act_${adAccountId}/insights?${params}`
  for (let page = 0; page < 30 && url; page++) {
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Meta insights failed (${res.status}): ${text.slice(0, 500)}`)
    }
    const body = (await res.json()) as MetaInsightsResponse
    for (const row of body.data ?? []) {
      const spend = Number(row.spend)
      const impressions = Number(row.impressions)
      if (!Number.isFinite(spend) || !Number.isFinite(impressions)) continue
      out.push({ day: row.date_start, spend, impressions })
    }
    url = body.paging?.next
  }

  // Defensive dedupe — Meta sometimes returns overlapping rows across pages.
  const byDay = new Map<string, DailyAdInsight>()
  for (const r of out) {
    const e = byDay.get(r.day)
    if (e) {
      e.spend += r.spend
      e.impressions += r.impressions
    } else {
      byDay.set(r.day, { ...r })
    }
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
}
