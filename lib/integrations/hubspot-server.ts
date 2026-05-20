/**
 * HubSpot CRM helper for KPI funnel data (qualified / unqualified / closes).
 *
 * Uses the Contacts Search API to pull contacts created in the lookback
 * window, filtered to a specific client via a custom `client_slug` property,
 * then buckets by date + lifecyclestage to emit per-day fact rows.
 *
 * Token: read via lib/config getConfig('HUBSPOT_ACCESS_TOKEN') to match the
 * existing /lib/hubspot/client.ts pattern (config UI, not env var). Falls
 * back to env HUBSPOT_ACCESS_TOKEN if the config row is unset, so cron
 * can run before the UI step is complete.
 *
 * For each contact in the window we emit (at most) two facts per day:
 *   - `qualified_leads`  when lifecyclestage ∈ qualifiedStages
 *   - `unqualified_leads` when lifecyclestage ∈ unqualifiedStages OR the
 *     contact never reached a qualified stage
 *
 * Deal-stage closes (closed-won) are a separate (object=deals) query —
 * deferred until needed; Stripe's `closes` fact already covers `close_rate`.
 */
import { getConfig } from '@/lib/config'

const HOST = 'https://api.hubapi.com'

export interface HubSpotConfig {
  token: string
}

export async function getHubSpotConfig(): Promise<HubSpotConfig | null> {
  // getConfig() already falls back to process.env[key] when the DB row is missing,
  // so no need to OR with process.env here.
  const token = await getConfig('HUBSPOT_ACCESS_TOKEN').catch(() => undefined)
  if (!token) return null
  return { token }
}

export async function isHubSpotConfigured(): Promise<boolean> {
  return (await getHubSpotConfig()) !== null
}

interface HSContact {
  id: string
  properties: {
    createdate?: string
    lifecyclestage?: string
    [k: string]: string | undefined
  }
}

interface HSSearchResponse {
  results: HSContact[]
  paging?: { next?: { after?: string } }
}

async function searchContacts(
  cfg: HubSpotConfig,
  body: Record<string, unknown>
): Promise<HSSearchResponse> {
  const res = await fetch(`${HOST}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot search failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return (await res.json()) as HSSearchResponse
}

const QUALIFIED_STAGES = new Set([
  'marketingqualifiedlead',
  'salesqualifiedlead',
  'opportunity',
  'customer',
  'evangelist',
])
const UNQUALIFIED_STAGES = new Set([
  'other',
  'unqualifiedlead',
  'subscriber',
  // contacts in `lead` who never progressed also count as unqualified — caller decides
])

export interface DailyFunnelCounts {
  day: string
  qualified: number
  unqualified: number
}

/**
 * Pull contacts for one client (matched on `properties.client_slug`) and
 * return per-day qualified / unqualified counts.
 *
 * `propertyKey` defaults to `client_slug` — set differently if your HubSpot
 * uses a different custom property to scope clients.
 */
export async function fetchDailyFunnelCounts(args: {
  config: HubSpotConfig
  lookbackDays: number
  propertyKey?: string
  propertyValue: string
}): Promise<DailyFunnelCounts[]> {
  const { config, lookbackDays, propertyValue } = args
  const propertyKey = args.propertyKey || 'client_slug'
  const days = Math.max(1, Math.min(365, Math.floor(lookbackDays)))
  const gte = Date.now() - days * 24 * 60 * 60 * 1000

  const totals = new Map<string, { qualified: number; unqualified: number }>()
  let after: string | undefined

  for (let page = 0; page < 200; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            { propertyName: 'createdate', operator: 'GTE', value: String(gte) },
            { propertyName: propertyKey, operator: 'EQ', value: propertyValue },
          ],
        },
      ],
      properties: ['createdate', 'lifecyclestage', propertyKey],
      sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
      limit: 100,
    }
    if (after) (body as { after?: string }).after = after

    const res = await searchContacts(config, body)
    for (const c of res.results) {
      const createMs = Number(c.properties.createdate)
      if (!Number.isFinite(createMs)) continue
      const day = new Date(createMs).toISOString().slice(0, 10)
      const stage = (c.properties.lifecyclestage ?? '').toLowerCase()
      const isQ = QUALIFIED_STAGES.has(stage)
      const isU = UNQUALIFIED_STAGES.has(stage) || (!isQ && stage === 'lead')
      const existing = totals.get(day) ?? { qualified: 0, unqualified: 0 }
      if (isQ) existing.qualified++
      if (isU) existing.unqualified++
      totals.set(day, existing)
    }
    after = res.paging?.next?.after
    if (!after || res.results.length === 0) break
  }

  return Array.from(totals.entries())
    .map(([day, t]) => ({ day, ...t }))
    .sort((a, b) => a.day.localeCompare(b.day))
}
