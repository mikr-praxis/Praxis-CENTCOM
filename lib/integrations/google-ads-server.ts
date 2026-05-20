/**
 * Google Ads API helper. Same KPI shape as Meta (daily spend + impressions
 * per customer), but Google's auth is more involved: OAuth2 refresh token
 * plus a separate developer token granted by Google.
 *
 * Required env vars (server-only):
 *   - GOOGLE_ADS_DEVELOPER_TOKEN  Granted to your manager account by Google.
 *   - GOOGLE_ADS_CLIENT_ID        OAuth2 client id (Google Cloud Console).
 *   - GOOGLE_ADS_CLIENT_SECRET    OAuth2 client secret.
 *   - GOOGLE_ADS_REFRESH_TOKEN    Refresh token from the OAuth consent flow.
 *   - GOOGLE_ADS_LOGIN_CUSTOMER_ID  Manager (MCC) customer id, no dashes.
 *
 * Per-client routing: each client maps to one Google Ads customer id stored
 * on `clients.google_ads_customer_id` (column added in a future migration).
 * Sync route accepts `?customer_id=` override for testing.
 *
 * Endpoint:
 *   POST https://googleads.googleapis.com/v17/customers/{customerId}/googleAds:searchStream
 *   GAQL query selects `metrics.cost_micros, metrics.impressions, segments.date`
 *   grouped by date in lookback window.
 */

const API_HOST = 'https://googleads.googleapis.com'
const API_VERSION = 'v17'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface GoogleAdsConfig {
  developerToken: string
  clientId: string
  clientSecret: string
  refreshToken: string
  loginCustomerId: string
}

export function getGoogleAdsConfig(): GoogleAdsConfig | null {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
  if (
    !developerToken ||
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    !loginCustomerId
  ) {
    return null
  }
  return {
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    loginCustomerId: loginCustomerId.replace(/-/g, ''),
  }
}

export function isGoogleAdsConfigured(): boolean {
  return getGoogleAdsConfig() !== null
}

/** Exchange the refresh token for a short-lived access token. */
async function getAccessToken(cfg: GoogleAdsConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google OAuth refresh failed (${res.status}): ${text.slice(0, 500)}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error('Google OAuth response missing access_token')
  }
  return json.access_token
}

interface GAQLResultRow {
  metrics?: { costMicros?: string; impressions?: string }
  segments?: { date?: string }
}

interface GAQLStreamResponse {
  results?: GAQLResultRow[]
}

export interface DailyAdInsight {
  day: string
  spend: number
  impressions: number
}

export async function fetchDailyAdInsights(args: {
  config: GoogleAdsConfig
  customerId: string
  lookbackDays: number
}): Promise<DailyAdInsight[]> {
  const { config, customerId, lookbackDays } = args
  const days = Math.max(1, Math.min(365, Math.floor(lookbackDays)))
  const cleanCustomerId = customerId.replace(/-/g, '')
  if (!/^\d+$/.test(cleanCustomerId)) {
    throw new Error(`Invalid Google Ads customer id: ${customerId}`)
  }

  const accessToken = await getAccessToken(config)
  const url = `${API_HOST}/${API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`
  const query = `
    SELECT segments.date, metrics.cost_micros, metrics.impressions
    FROM customer
    WHERE segments.date DURING LAST_${days}_DAYS
  `.trim()

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': config.developerToken,
      'login-customer-id': config.loginCustomerId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Ads search failed (${res.status}): ${text.slice(0, 500)}`)
  }
  // searchStream returns an array of response chunks.
  const chunks = (await res.json()) as GAQLStreamResponse | GAQLStreamResponse[]
  const allChunks = Array.isArray(chunks) ? chunks : [chunks]

  const byDay = new Map<string, DailyAdInsight>()
  for (const chunk of allChunks) {
    for (const row of chunk.results ?? []) {
      const day = row.segments?.date
      const costMicros = Number(row.metrics?.costMicros)
      const impressions = Number(row.metrics?.impressions)
      if (!day || !Number.isFinite(costMicros) || !Number.isFinite(impressions)) continue
      const e = byDay.get(day) ?? { day, spend: 0, impressions: 0 }
      e.spend += costMicros / 1e6
      e.impressions += impressions
      byDay.set(day, e)
    }
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
}
