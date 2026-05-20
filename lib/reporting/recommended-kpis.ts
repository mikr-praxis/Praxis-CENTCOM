/**
 * Heuristic catalog → formula matcher used by the "Set up recommended KPIs"
 * action. Inspects the columns of a client's synced Drive files, picks the
 * best column for each input slot in every catalog entry, and emits a
 * fully-formed Formula when (and only when) every required input has a
 * confident column match. Catalog entries with missing inputs are skipped —
 * the user falls back to the existing "+ Add KPI" / KPIConfigModal flow for
 * those.
 *
 * Today the only data source is Google Drive (see
 * content/memory/kpi-data-sources-plan.md for the long-term map). When new
 * source types land, the matcher should grow a `source_type` axis so it
 * picks Stripe/Meta/etc. before falling back to Drive columns.
 */
import {
  STANDARD_CATALOG,
  CUSTOMIZABLE_CATALOG,
  type CatalogEntry,
  type CatalogInput,
  type CatalogInputState,
  type CatalogInputValue,
} from './kpi-catalog'
import type { Formula } from './types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

export interface FileColumns {
  filename: string
  columns: string[]
}

interface ColumnMatch {
  filename: string
  column: string
  score: number
}

// Synonyms keyed by catalog input id (see lib/reporting/kpi-catalog.ts).
// Earlier patterns score higher when multiple match the same column —
// lets us prefer "Amount Spent" over a generic "Amount" column.
const COLUMN_SYNONYMS: Record<string, RegExp[]> = {
  // Paid media
  spend: [/amount[ _-]*spent/i, /ad[ _-]*spend/i, /\bspend\b/i, /\bcost\b/i],
  impressions: [/\bimpressions?\b/i, /\bimpr\b/i],
  spend_sources: [/amount[ _-]*spent/i, /ad[ _-]*spend/i, /\bspend\b/i, /\bcost\b/i],

  // Funnel — opt-ins / leads
  optins: [/opt[ _-]*ins?/i, /new[ _-]*leads?/i, /\bsignups?\b/i, /registrants?/i, /\bleads?\b/i],
  leads: [/\bleads?\b/i, /opt[ _-]*ins?/i, /new[ _-]*leads?/i, /\bsignups?\b/i],

  // Funnel — qualification
  qualified: [/qualified[ _-]*leads?/i, /\bqualified\b/i, /\bsql\b/i, /\bmql\b/i],
  unqualified: [/unqualified[ _-]*leads?/i, /\bunqualified\b/i, /disqualified/i, /\bdnq\b/i],

  // Calls
  calls_booked: [/calls?[ _-]*booked/i, /booked[ _-]*calls?/i, /\bbookings?\b/i, /appointments?/i],
  booked: [/calls?[ _-]*booked/i, /booked[ _-]*calls?/i, /\bbookings?\b/i, /appointments?/i],
  calls: [/calls?[ _-]*booked/i, /booked[ _-]*calls?/i, /\bbookings?\b/i],
  shows: [/calls?[ _-]*showed/i, /\bshowed\b/i, /\bshows?\b/i, /\battended\b/i, /attendees?/i],
  pitch_attendees: [
    /pitch[ _-]*attendees?/i,
    /present[ _-]*at[ _-]*pitch/i,
    /stayed[ _-]*for[ _-]*pitch/i,
    /webinar[ _-]*attendees?/i,
  ],

  // Sales
  closes: [/closed?[ _-]*won/i, /\bcloses?\b/i, /deals?[ _-]*closed/i, /\bwins?\b/i, /\bsales\b/i],
  cash: [/cash[ _-]*collected/i, /\bcollected\b/i, /\bcash\b/i, /revenue[ _-]*collected/i],

  // Standard tile — revenue (LIFETIME, all_files)
  revenue: [/\brevenue\b/i, /\bgmv\b/i, /gross[ _-]*revenue/i, /total[ _-]*sales/i, /\bsales\b/i],
}

function matchColumn(inputId: string, files: FileColumns[]): ColumnMatch | null {
  const patterns = COLUMN_SYNONYMS[inputId]
  if (!patterns) return null
  let best: ColumnMatch | null = null
  for (const file of files) {
    for (const col of file.columns) {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(col)) {
          const score = patterns.length - i
          if (!best || score > best.score) {
            best = { filename: file.filename, column: col, score }
          }
          break
        }
      }
    }
  }
  return best
}

export interface RecommendedKPI {
  catalog_key: string
  display_name: string
  description: string
  format: KPIFormat
  viz_type: KPIVizType
  formula: Formula
  /** Per-input file+column trail; useful for debug / audit on the response. */
  inputs_matched: Record<string, { filename: string; column: string }>
}

function tryBuild(
  entry: CatalogEntry,
  inputs: CatalogInput[],
  build: NonNullable<CatalogEntry['build']>,
  files: FileColumns[]
): { formula: Formula; matched: Record<string, { filename: string; column: string }> } | null {
  const state: Record<string, CatalogInputValue> = {}
  const matched: Record<string, { filename: string; column: string }> = {}

  for (const input of inputs) {
    const m = matchColumn(input.id, files)
    if (!m) return null

    const single: CatalogInputState = {
      // For all_files-scoped inputs the source is ignored by the engine; we
      // pass the matched filename anyway so downstream UI shows where the
      // column lives.
      source: input.scope === 'all_files' ? '*' : m.filename,
      column: m.column,
    }
    state[input.id] = input.repeatable ? [single] : single
    matched[input.id] = { filename: m.filename, column: m.column }
  }

  const formula = build(state)
  if (!formula) return null
  return { formula, matched }
}

/** Per-source overrides — when an external integration is configured, the
 *  matcher emits a typed source_type AggOp instead of falling back to Drive
 *  column matching for that catalog entry. See content/memory/no-virtual-files.md
 *  for why this is a typed source_type, not a fake filename. */
export interface SourceAvailability {
  /** True when POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID are set. */
  posthog: boolean
  /** True when STRIPE_SECRET_KEY is set. Unlocks `cash_collected` + `close_rate` numerator. */
  stripe?: boolean
  /** True when HubSpot token is configured (env or app_config). Unlocks
   *  `qualified_leads`, `unqualified_leads`, `qualified_ratio`. */
  hubspot?: boolean
  /** True when META_ACCESS_TOKEN is set. Unlocks `amount_spent` + `cpm`
   *  (and contributes to `total_blended_cost`). */
  meta_ads?: boolean
  /** True when the full Google Ads OAuth env is set. Same KPIs as meta_ads. */
  google_ads?: boolean
}

/** A typed-source AggOp template for a given (catalog_key, source_type, kind). */
function typedFormula(
  source_type: string,
  kind: string,
  op: 'sum' = 'sum'
): import('./types').AggOp {
  return {
    op,
    source: '',
    source_type,
    kind,
    column: 'value',
    timeframe_column: 'ts',
  }
}

/**
 * Returns one RecommendedKPI per catalog entry whose inputs were fully
 * matched. Entries with any unmatched input are silently skipped — the
 * user can still pick them manually. Variant entries (e.g. the conversion
 * rate three-way pick) emit at most one row, using the canonical
 * un-suffixed catalog_key so std_* dashboard logic still recognizes them.
 *
 * When `availability.posthog` is true, the `opt_ins` catalog entry emits a
 * typed PostHog AggOp (source_type='posthog', kind='opt_ins') regardless of
 * Drive column presence — facts written by /api/integrations/posthog/sync
 * become the truth source.
 */
export function buildRecommendedKPIs(
  files: FileColumns[],
  availability: SourceAvailability = { posthog: false }
): RecommendedKPI[] {
  const all: CatalogEntry[] = [...STANDARD_CATALOG, ...CUSTOMIZABLE_CATALOG]
  const out: RecommendedKPI[] = []

  function emit(catalogKey: string, sourceType: string, kind: string, providerLabel: string) {
    const entry = all.find((e) => e.catalog_key === catalogKey)
    if (!entry) return
    out.push({
      catalog_key: entry.catalog_key,
      display_name: `${entry.display_name} (${providerLabel})`,
      description: `${entry.description} Sourced from ${providerLabel} via /api/integrations/${sourceType}/sync.`,
      format: entry.format,
      viz_type: entry.viz_type,
      formula: typedFormula(sourceType, kind),
      inputs_matched: { [kind]: { filename: `${sourceType}:${kind}`, column: 'value' } },
    })
  }

  // PostHog → opt_ins
  if (availability.posthog) emit('opt_ins', 'posthog', 'opt_ins', 'PostHog')

  // Stripe → cash_collected (revenue). close_rate also gets a Stripe-backed
  // numerator via the `closes` fact the sync route writes alongside.
  if (availability.stripe) emit('cash_collected', 'stripe', 'cash_collected', 'Stripe')

  // HubSpot → qualified_leads, unqualified_leads, qualified_ratio
  if (availability.hubspot) {
    emit('qualified_leads', 'hubspot', 'qualified_leads', 'HubSpot')
    emit('unqualified_leads', 'hubspot', 'unqualified_leads', 'HubSpot')
    // qualified_ratio = qualified / unqualified — compose typed AggOps directly
    const ratioEntry = all.find((e) => e.catalog_key === 'qualified_ratio')
    if (ratioEntry) {
      out.push({
        catalog_key: ratioEntry.catalog_key,
        display_name: `${ratioEntry.display_name} (HubSpot)`,
        description: `${ratioEntry.description} Sourced from HubSpot via /api/integrations/hubspot/sync.`,
        format: ratioEntry.format,
        viz_type: ratioEntry.viz_type,
        formula: {
          op: 'divide',
          numerator: typedFormula('hubspot', 'qualified_leads'),
          denominator: typedFormula('hubspot', 'unqualified_leads'),
        },
        inputs_matched: {
          qualified: { filename: 'hubspot:qualified_leads', column: 'value' },
          unqualified: { filename: 'hubspot:unqualified_leads', column: 'value' },
        },
      })
    }
  }

  // Meta Ads → amount_spent + cpm
  if (availability.meta_ads) {
    emit('amount_spent', 'meta_ads', 'amount_spent', 'Meta Ads')
    // cpm = (spend / impressions) * 1000
    const cpmEntry = all.find((e) => e.catalog_key === 'cpm')
    if (cpmEntry) {
      out.push({
        catalog_key: cpmEntry.catalog_key,
        display_name: `${cpmEntry.display_name} (Meta Ads)`,
        description: `${cpmEntry.description} Sourced from Meta Marketing API via /api/integrations/meta-ads/sync.`,
        format: cpmEntry.format,
        viz_type: cpmEntry.viz_type,
        formula: {
          op: 'multiply',
          left: {
            op: 'divide',
            numerator: typedFormula('meta_ads', 'amount_spent'),
            denominator: typedFormula('meta_ads', 'impressions'),
          },
          right: { op: 'const', value: 1000 },
        },
        inputs_matched: {
          spend: { filename: 'meta_ads:amount_spent', column: 'value' },
          impressions: { filename: 'meta_ads:impressions', column: 'value' },
        },
      })
    }
  }

  // Google Ads — same KPIs as Meta, only emit if Meta didn't already claim
  // those slots so we don't double-recommend amount_spent / cpm.
  if (availability.google_ads && !availability.meta_ads) {
    emit('amount_spent', 'google_ads', 'amount_spent', 'Google Ads')
    const cpmEntry = all.find((e) => e.catalog_key === 'cpm')
    if (cpmEntry) {
      out.push({
        catalog_key: cpmEntry.catalog_key,
        display_name: `${cpmEntry.display_name} (Google Ads)`,
        description: `${cpmEntry.description} Sourced from Google Ads via /api/integrations/google-ads/sync.`,
        format: cpmEntry.format,
        viz_type: cpmEntry.viz_type,
        formula: {
          op: 'multiply',
          left: {
            op: 'divide',
            numerator: typedFormula('google_ads', 'amount_spent'),
            denominator: typedFormula('google_ads', 'impressions'),
          },
          right: { op: 'const', value: 1000 },
        },
        inputs_matched: {
          spend: { filename: 'google_ads:amount_spent', column: 'value' },
          impressions: { filename: 'google_ads:impressions', column: 'value' },
        },
      })
    }
  }

  if (files.length === 0) return out

  // Catalog keys we already emitted via an external source — skip them in the
  // Drive-column scan so we don't double-recommend the same KPI.
  const alreadyEmitted = new Set(out.map((r) => r.catalog_key))

  for (const entry of all) {
    if (alreadyEmitted.has(entry.catalog_key)) continue
    if (entry.variants && entry.variants.length > 0) {
      for (const variant of entry.variants) {
        const result = tryBuild(entry, variant.inputs, variant.build, files)
        if (result) {
          out.push({
            catalog_key: entry.catalog_key,
            display_name: `${entry.display_name} — ${variant.label}`,
            description: `${entry.description} (${variant.description})`,
            format: entry.format,
            viz_type: entry.viz_type,
            formula: result.formula,
            inputs_matched: result.matched,
          })
          break
        }
      }
    } else if (entry.inputs && entry.build) {
      const result = tryBuild(entry, entry.inputs, entry.build, files)
      if (result) {
        out.push({
          catalog_key: entry.catalog_key,
          display_name: entry.display_name,
          description: entry.description,
          format: entry.format,
          viz_type: entry.viz_type,
          formula: result.formula,
          inputs_matched: result.matched,
        })
      }
    }
  }

  return out
}
