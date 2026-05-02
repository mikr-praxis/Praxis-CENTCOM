/**
 * Column auto-detection for the standard lifetime tiles. Given the columns
 * present across a client's synced Drive files, identify the most likely
 * column for each canonical metric (cash collected, calls booked, leads,
 * closes) so the standard tiles can render zero-config.
 *
 * Detection is heuristic: it scans column names for known aliases, scores
 * each match, and returns the strongest. If no match is found, the tile
 * stays in "Configure" mode and the user can set it manually via the gear.
 */

import { CALL_FUNNEL_METRICS } from '@/lib/metrics/call-funnel'
import type { CanonicalMetric } from '@/lib/metrics/types'

/** Slugify a column header for tolerant matching ("Cash Collected" → "cash collected"). */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ')
}

/** Score how well a column name matches a canonical metric. Higher is better.
 *  Returns 0 when no match. */
function scoreColumnForMetric(column: string, metric: CanonicalMetric): number {
  const norm = normalize(column)
  let best = 0

  // Exact key match (e.g. "cash_collected" column → cash_collected metric).
  if (norm === normalize(metric.key)) best = Math.max(best, 100)
  // Display-name match
  if (norm === normalize(metric.display_name)) best = Math.max(best, 95)
  // Aliases — exact and substring
  for (const alias of metric.aliases) {
    const a = normalize(alias)
    if (norm === a) best = Math.max(best, 90)
    else if (norm.includes(a)) best = Math.max(best, 70)
    else if (a.includes(norm)) best = Math.max(best, 60)
  }
  // Display-name substring
  if (norm.includes(normalize(metric.display_name))) best = Math.max(best, 50)
  return best
}

/** Among all (file, column) pairs, pick the one that best matches `metric`.
 *  Returns null if no column scored above the threshold. */
function pickBestColumn(
  files: { filename: string; columns: string[] }[],
  metric: CanonicalMetric,
  minScore = 50
): string | null {
  const seen = new Set<string>()
  let best: { column: string; score: number } | null = null
  for (const file of files) {
    for (const col of file.columns) {
      if (seen.has(col)) continue
      seen.add(col)
      const score = scoreColumnForMetric(col, metric)
      if (score >= minScore && (!best || score > best.score)) {
        best = { column: col, score }
      }
    }
  }
  return best?.column ?? null
}

/** What we resolved (or didn't) for a client's synced files. */
export interface AutoDetected {
  /** Column name to sum for cash collected. */
  revenue_column: string | null
  /** Column to sum for calls booked. */
  calls_booked_column: string | null
  /** Column to sum for closes / sales. */
  closes_column: string | null
  /** Column to sum for leads / opt-ins. */
  leads_column: string | null
  /** Column to sum for calls showed. */
  shows_column: string | null
}

/** Resolve the canonical metric columns from a flat list of synced files. */
export function autoDetectColumns(
  files: { filename: string; columns: string[] }[]
): AutoDetected {
  const byKey = new Map(CALL_FUNNEL_METRICS.map((m) => [m.key, m]))
  const cashCollected = byKey.get('cash_collected')
  const callsBooked = byKey.get('calls_booked')
  const closes = byKey.get('closes')
  const leads = byKey.get('leads')
  const calls_showed = byKey.get('calls_showed')

  return {
    revenue_column: cashCollected ? pickBestColumn(files, cashCollected) : null,
    calls_booked_column: callsBooked ? pickBestColumn(files, callsBooked) : null,
    closes_column: closes ? pickBestColumn(files, closes) : null,
    leads_column: leads ? pickBestColumn(files, leads) : null,
    shows_column: calls_showed ? pickBestColumn(files, calls_showed) : null,
  }
}
