/**
 * Zero-config column auto-detection.
 *
 * Given the synced files for a client, scan their column names + sample values
 * and pick the best match for each canonical funnel metric (spend, leads,
 * calls_booked, etc.). The /standard-tiles endpoint then composes lifetime KPIs
 * (CPL, ROAS, show rate, etc.) on top of these detections — no setup required
 * from the user.
 *
 * Pure functions. No I/O. Used by /api/reporting/[slug]/standard-tiles.
 */

import type { RawFileForEngine } from './types'

/** The canonical metrics we know how to recognize from column names. */
export type CanonicalMetric =
  | 'spend'
  | 'impressions'
  | 'clicks'
  | 'leads'
  | 'qualified_leads'
  | 'calls_booked'
  | 'calls_showed'
  | 'closes'
  | 'revenue'
  | 'cash_collected'

/** Detected column name per metric (or null when nothing usable was found). */
export type DetectedColumns = Record<CanonicalMetric, string | null>

interface MetricHint {
  /** Keyword phrases — we score columns by how strongly their normalized name
   *  matches one of these. Order matters loosely: stronger / less ambiguous
   *  phrases first. */
  keywords: string[]
  /** Anti-keywords — phrases that indicate a column is something ELSE that
   *  superficially looks like the target. e.g. "lead source" is not "leads". */
  anti: string[]
  /** When `false`, we accept non-numeric columns (e.g. when counting rows by
   *  presence). When `true`, the column must look numeric in sample rows. */
  numeric: boolean
}

/** Per-metric column-name hints. Hand-tuned for ad/funnel reporting sheets. */
const HINTS: Record<CanonicalMetric, MetricHint> = {
  spend: {
    keywords: [
      'amount spent',
      'amt spent',
      'ad spend',
      'paid spend',
      'media cost',
      'media spend',
      'total spend',
      'spend',
      'total cost',
      'ad cost',
      'cost',
    ],
    anti: ['cost per', 'cost/', 'cpc', 'cpm', 'cpl'],
    numeric: true,
  },
  impressions: {
    keywords: ['impressions', 'impression', 'impr'],
    anti: [],
    numeric: true,
  },
  clicks: {
    keywords: ['link clicks', 'unique clicks', 'all clicks', 'clicks'],
    anti: ['cost per click', 'cpc', 'click through', 'ctr'],
    numeric: true,
  },
  leads: {
    keywords: [
      'opt-ins',
      'opt ins',
      'optins',
      'new leads',
      'total leads',
      'leads',
      'sign ups',
      'signups',
      'registrations',
      'subscribers',
    ],
    anti: ['lead source', 'lead status', 'qualified lead', 'cost per lead', 'cpl'],
    numeric: true,
  },
  qualified_leads: {
    keywords: [
      'qualified leads',
      'qualified',
      'qls',
      'sql',
      'mql',
      'sales qualified',
      'marketing qualified',
    ],
    anti: ['unqualified', 'cost per qualified', 'qualified rate'],
    numeric: true,
  },
  calls_booked: {
    keywords: [
      'calls booked',
      'booked calls',
      'appointments booked',
      'appts booked',
      'sets',
      'bookings',
      'booked',
      'scheduled',
      'calls scheduled',
    ],
    anti: ['cost per book', 'show rate', 'showed', 'closed', 'show'],
    numeric: true,
  },
  calls_showed: {
    keywords: [
      'calls showed',
      'calls attended',
      'calls held',
      'calls kept',
      'showed up',
      'attended',
      'shows',
      'showed',
      'present',
      'kept',
    ],
    anti: ['no show', 'noshow', 'show rate'],
    numeric: true,
  },
  closes: {
    keywords: [
      'closed won',
      'closed-won',
      'sales closed',
      'deals won',
      'deals closed',
      'sales',
      'closes',
      'closed',
      'wins',
      'won',
      'conversions',
      'customers acquired',
    ],
    anti: ['close rate', 'closed lost', 'closed-lost', 'close ratio'],
    numeric: true,
  },
  revenue: {
    keywords: [
      'total revenue',
      'gross revenue',
      'sales revenue',
      'revenue',
      'contract value',
      'deal value',
      'total sales',
      'gross sales',
    ],
    anti: ['per revenue', 'revenue per', 'revenue rate', 'revenue %'],
    numeric: true,
  },
  cash_collected: {
    keywords: [
      'cash collected',
      'cash collection',
      'collected',
      'payments received',
      'payments collected',
      'deposits collected',
    ],
    anti: ['cash collected per', 'cash rate'],
    numeric: true,
  },
}

const METRICS: CanonicalMetric[] = Object.keys(HINTS) as CanonicalMetric[]

/** Strip punctuation, collapse whitespace, lowercase. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-\.\,\(\)\[\]\{\}\:\;\!\?\$\%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Heuristic: looks like a number after stripping currency / commas / %. */
function looksNumeric(value: unknown): boolean {
  if (value == null || value === '') return false
  if (typeof value === 'number') return Number.isFinite(value)
  const str = String(value).trim()
  if (str === '') return false
  const stripped = str.replace(/[$,\s]/g, '').replace(/%$/, '')
  const n = Number(stripped)
  return Number.isFinite(n)
}

/** Sample up to `limit` non-empty cells from a column across all files. */
function sampleColumn(
  files: RawFileForEngine[],
  column: string,
  limit = 100
): unknown[] {
  const out: unknown[] = []
  for (const file of files) {
    if (!file.columns.includes(column)) continue
    for (const row of file.rows) {
      const v = row[column]
      if (v == null || v === '') continue
      out.push(v)
      if (out.length >= limit) return out
    }
    if (out.length >= limit) return out
  }
  return out
}

/** Fraction of sampled cells that look numeric (0..1). */
function numericFraction(samples: unknown[]): number {
  if (samples.length === 0) return 0
  let n = 0
  for (const v of samples) if (looksNumeric(v)) n++
  return n / samples.length
}

/** Score how well `column` matches `metric`. Higher = better. 0 = reject. */
function scoreColumn(
  column: string,
  metric: CanonicalMetric,
  files: RawFileForEngine[]
): number {
  const hint = HINTS[metric]
  const norm = normalize(column)

  // Anti-keyword hard filter — a column matching any anti-keyword is rejected
  // outright unless its primary keyword is a much stronger match. We keep this
  // simple: if any anti-phrase is a substring, skip.
  for (const anti of hint.anti) {
    if (norm.includes(anti)) return 0
  }

  // Keyword scoring: exact match > whole-word match > substring match.
  let kwScore = 0
  for (let i = 0; i < hint.keywords.length; i++) {
    const kw = hint.keywords[i]
    // Earlier keywords are stronger signals — boost by position.
    const positionBonus = (hint.keywords.length - i) / hint.keywords.length
    if (norm === kw) {
      kwScore = Math.max(kwScore, 100 * positionBonus)
      break
    }
    // Whole-word match: kw is one of the space-separated tokens (or the full string)
    const tokens = norm.split(' ')
    if (tokens.join(' ') === kw || tokens.includes(kw)) {
      kwScore = Math.max(kwScore, 80 * positionBonus)
      continue
    }
    if (norm.includes(kw)) {
      kwScore = Math.max(kwScore, 50 * positionBonus)
    }
  }
  if (kwScore === 0) return 0

  // Numeric validation — pull a sample, ensure ≥ 50% looks numeric for
  // numeric metrics. Otherwise heavily penalize.
  if (hint.numeric) {
    const samples = sampleColumn(files, column)
    const frac = numericFraction(samples)
    // No samples at all → don't penalize (column might be empty by design);
    // require at least 30% numeric otherwise.
    if (samples.length > 0 && frac < 0.3) return 0
    // Boost columns that have any data at all.
    if (samples.length > 0) kwScore *= 1 + Math.min(0.3, frac * 0.3)
  }

  // Universality bonus — columns that appear in more files are more likely the
  // canonical metric (vs a one-file-only quirk).
  const filesWithCol = files.filter((f) => f.columns.includes(column)).length
  const universalityBonus = filesWithCol > 1 ? 1 + Math.log(filesWithCol) * 0.1 : 1
  kwScore *= universalityBonus

  return kwScore
}

/** Return all unique column names across the synced files. */
function allColumns(files: RawFileForEngine[]): string[] {
  const seen = new Set<string>()
  for (const f of files) for (const c of f.columns) seen.add(c)
  return Array.from(seen)
}

/**
 * Walk every column once per metric and pick the highest-scoring one. Returns
 * a mapping `metric → column-name | null`. A column may legitimately win
 * multiple metrics (e.g. a sheet that uses the same column for both shows and
 * attended) — we don't dedupe.
 */
export function autoDetectColumns(files: RawFileForEngine[]): DetectedColumns {
  const columns = allColumns(files)
  const result: DetectedColumns = {
    spend: null,
    impressions: null,
    clicks: null,
    leads: null,
    qualified_leads: null,
    calls_booked: null,
    calls_showed: null,
    closes: null,
    revenue: null,
    cash_collected: null,
  }
  if (columns.length === 0) return result

  for (const metric of METRICS) {
    let best: { col: string; score: number } | null = null
    for (const col of columns) {
      const score = scoreColumn(col, metric, files)
      if (score > 0 && (!best || score > best.score)) {
        best = { col, score }
      }
    }
    result[metric] = best?.col ?? null
  }

  return result
}

/** Friendly labels for the detected metrics — used in UI hints. */
export const METRIC_LABELS: Record<CanonicalMetric, string> = {
  spend: 'Spend',
  impressions: 'Impressions',
  clicks: 'Clicks',
  leads: 'Leads',
  qualified_leads: 'Qualified leads',
  calls_booked: 'Calls booked',
  calls_showed: 'Calls showed',
  closes: 'Closes',
  revenue: 'Revenue',
  cash_collected: 'Cash collected',
}
