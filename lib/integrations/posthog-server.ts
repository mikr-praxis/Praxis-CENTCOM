/**
 * Server-side PostHog query helper. Uses the HogQL query endpoint
 * (POST /api/projects/{id}/query/) to pull aggregated event counts that
 * become rows in report_external_facts.
 *
 * Required env vars (server-only — never NEXT_PUBLIC_):
 *   - POSTHOG_PERSONAL_API_KEY — Personal API Key with `query:read` scope.
 *   - POSTHOG_PROJECT_ID       — Numeric project id (e.g. "12345").
 * Optional:
 *   - NEXT_PUBLIC_POSTHOG_HOST — Reused; defaults to https://app.posthog.com.
 */

const DEFAULT_HOST = 'https://app.posthog.com'

export interface PostHogConfig {
  personalApiKey: string
  projectId: string
  host: string
}

export class PostHogConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostHogConfigError'
  }
}

export function getPostHogConfig(): PostHogConfig | null {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  if (!personalApiKey || !projectId) return null
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST).replace(/\/$/, '')
  return { personalApiKey, projectId, host }
}

export function isPostHogConfigured(): boolean {
  return getPostHogConfig() !== null
}

/**
 * Slugs are URL-safe by construction in this codebase, but we still defend
 * the HogQL string interpolation. Anything outside [a-z0-9-_] is rejected
 * outright rather than escaped — invalid slug = caller bug, not a recovery
 * case.
 */
function assertSafeSlug(slug: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    throw new Error(`Unsafe slug for HogQL interpolation: ${slug}`)
  }
}

function assertSafeIdentifier(s: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(s)) {
    throw new Error(`Unsafe identifier for HogQL interpolation: ${s}`)
  }
}

interface HogQLResult {
  columns: string[]
  results: unknown[][]
}

async function runHogQL(cfg: PostHogConfig, query: string): Promise<HogQLResult> {
  const url = `${cfg.host}/api/projects/${cfg.projectId}/query/`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.personalApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PostHog query failed (${res.status}): ${text.slice(0, 500)}`)
  }
  const body = (await res.json()) as Partial<HogQLResult>
  if (!Array.isArray(body.results)) {
    throw new Error('PostHog response missing `results`')
  }
  return {
    columns: Array.isArray(body.columns) ? body.columns : [],
    results: body.results,
  }
}

export interface DailyCount {
  /** ISO date 'YYYY-MM-DD' (UTC bucket from PostHog). */
  day: string
  count: number
}

/**
 * Pull daily event counts for `event` filtered to rows where the JSON
 * property `propertyKey` equals `propertyValue`. Returns one row per day in
 * the lookback window, including days with zero events (PostHog HogQL omits
 * those — we don't backfill zeros here; the caller is the one writing
 * facts, so missing days simply mean no facts for that day, which the engine
 * treats as zero on read).
 */
export async function fetchDailyEventCounts(args: {
  config: PostHogConfig
  event: string
  propertyKey: string
  propertyValue: string
  lookbackDays: number
}): Promise<DailyCount[]> {
  const { config, event, propertyKey, propertyValue, lookbackDays } = args
  assertSafeIdentifier(propertyKey)
  assertSafeSlug(propertyValue)
  // Event name and lookback also need defending — they're not slugs but
  // they're caller-controlled. Whitelist event to common chars and
  // clamp lookback.
  if (!/^[a-zA-Z0-9_$.-]+$/.test(event)) {
    throw new Error(`Unsafe event name: ${event}`)
  }
  const days = Math.max(1, Math.min(365, Math.floor(lookbackDays)))

  // HogQL: properties access via `properties.<key>`. We escape the event
  // name with single quotes after the regex check above.
  const query = `
    SELECT toDate(timestamp) AS day, count() AS cnt
    FROM events
    WHERE event = '${event}'
      AND properties.${propertyKey} = '${propertyValue}'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY day
    ORDER BY day
  `.trim()

  const { results } = await runHogQL(config, query)
  const out: DailyCount[] = []
  for (const row of results) {
    const day = row[0]
    const cnt = row[1]
    if (typeof day !== 'string' && !(day instanceof Date)) continue
    const dayStr = typeof day === 'string' ? day.slice(0, 10) : day.toISOString().slice(0, 10)
    const cntNum = typeof cnt === 'number' ? cnt : Number(cnt)
    if (!Number.isFinite(cntNum)) continue
    out.push({ day: dayStr, count: cntNum })
  }
  return out
}

export interface TopEvent {
  event: string
  count: number
  /** Up to 10 property keys observed on this event, with sample values
   *  (first non-null), for quickly matching the sync filter to real data. */
  properties: { key: string; sample: string }[]
}

/**
 * Diagnostic helper: what events does PostHog actually have for this project
 * in the lookback window, ranked by volume, with their property keys? Used by
 * /api/integrations/posthog/inspect so the sync workflow can self-diagnose
 * when total_upserted: 0 (event name / property mismatch is the usual cause).
 */
export async function fetchTopEvents(args: {
  config: PostHogConfig
  lookbackDays: number
  limit?: number
}): Promise<TopEvent[]> {
  const { config, lookbackDays } = args
  const days = Math.max(1, Math.min(365, Math.floor(lookbackDays)))
  const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 20)))

  // Top events by count.
  const eventsQ = `
    SELECT event, count() AS cnt
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY event
    ORDER BY cnt DESC
    LIMIT ${limit}
  `.trim()
  const { results: eventRows } = await runHogQL(config, eventsQ)
  const out: TopEvent[] = []
  for (const row of eventRows) {
    const ev = String(row[0] ?? '')
    const cnt = Number(row[1] ?? 0)
    if (!ev) continue
    out.push({ event: ev, count: cnt, properties: [] })
  }

  // For each event, fetch the keys + a sample value. Bounded by `out.length`
  // (<=20 by default) so cost stays tiny.
  for (const e of out) {
    // Event name has gone through the regex check above (it came from
    // PostHog itself), but defensively quote-escape just in case.
    const safeEvent = e.event.replace(/'/g, "''")
    const propsQ = `
      SELECT key, anyIf(value, value IS NOT NULL AND value != '') AS sample
      FROM (
        SELECT arrayJoin(JSONExtractKeysAndValuesRaw(properties)) AS kv,
               kv.1 AS key, kv.2 AS value
        FROM events
        WHERE event = '${safeEvent}'
          AND timestamp >= now() - INTERVAL ${days} DAY
      )
      GROUP BY key
      ORDER BY count() DESC
      LIMIT 10
    `.trim()
    try {
      const { results: propRows } = await runHogQL(config, propsQ)
      for (const row of propRows) {
        const key = String(row[0] ?? '')
        const sample = row[1] == null ? '' : String(row[1]).slice(0, 80)
        if (key) e.properties.push({ key, sample })
      }
    } catch {
      // Best-effort — skip property enumeration if HogQL rejects this shape
      // on a particular event (rare; usually only on `$exception` events
      // that have nested JSON).
    }
  }

  return out
}
