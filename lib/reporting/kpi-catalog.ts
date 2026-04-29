/**
 * Curated KPI catalog. Each entry is a template a user can pick from the
 * "+ Add tile" menu and wire up to their Drive sheets via column mapping.
 *
 * The 3 reserved `std_*` entries are the always-on "Standard" tiles that
 * render at the top of the client view in lifetime mode (ignoring the
 * page-level TimeframePicker).
 *
 * A catalog entry produces a `Formula` (lib/reporting/types) once the user
 * has filled in its inputs (each a {source, column, [filters]} mapping).
 * Formulas are stored on `report_kpis` like any other KPI — no schema
 * change is needed; the `key` column carries the catalog key so the UI
 * can recognize standards / configured-catalog entries on read.
 */

import type { Formula, AggOp, Filter } from './types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

/* ───────────────────────────── Types ───────────────────────────── */

/** A single input slot the user maps to a Drive sheet column. */
export interface CatalogInput {
  id: string
  label: string
  /** Helpful hint shown in the UI to bias which column the user picks. */
  hint?: string
  /** Aggregation op applied to the mapped column. */
  agg_op: 'sum' | 'count' | 'count_distinct' | 'avg' | 'min' | 'max'
  /** When true, the user can add multiple {source,column} mappings that get summed. */
  repeatable?: boolean
  /** When true, the user is encouraged to add row filters (e.g. status = qualified). */
  filterable?: boolean
}

/** The shape of user input the modal collects per slot. */
export interface CatalogInputState {
  source: string
  column: string
  filters?: Filter[]
  /** Optional date column for timeframe filtering — only used by the standard
   *  "lifetime" tiles when a user wants to lock the column for future
   *  non-lifetime uses. Ignored for std_* keys at evaluation time. */
  timeframe_column?: string
}

/** State for a single catalog input (single or repeatable). */
export type CatalogInputValue = CatalogInputState | CatalogInputState[]

/** A KPI variant — used when one catalog entry exposes a choice (e.g.
 *  Total Conversion Rate's three numerator/denominator options). */
export interface CatalogVariant {
  id: string
  label: string
  description: string
  inputs: CatalogInput[]
  build: (state: Record<string, CatalogInputValue>) => Formula | null
}

export interface CatalogEntry {
  /** Stable id; becomes the kpi.key on the row. */
  catalog_key: string
  display_name: string
  description: string
  category: 'standard' | 'paid_media' | 'funnel' | 'sales'
  format: KPIFormat
  viz_type: KPIVizType
  /** Either a flat input list OR variants (mutually exclusive). */
  inputs?: CatalogInput[]
  variants?: CatalogVariant[]
  /** Formula builder for the flat case. Variants override this. */
  build?: (state: Record<string, CatalogInputValue>) => Formula | null
}

/* ──────────────────────── Helpers ──────────────────────── */

function makeAgg(s: CatalogInputState, op: CatalogInput['agg_op']): AggOp {
  return {
    op,
    source: s.source,
    column: s.column,
    ...(s.filters && s.filters.length > 0 ? { filters: s.filters } : {}),
    ...(s.timeframe_column ? { timeframe_column: s.timeframe_column } : {}),
  }
}

function asSingle(v: CatalogInputValue | undefined): CatalogInputState | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

function asList(v: CatalogInputValue | undefined): CatalogInputState[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/** Sum together N AggOps via repeated `add` composites. */
function sumAggs(aggs: AggOp[]): Formula | null {
  if (aggs.length === 0) return null
  if (aggs.length === 1) return aggs[0]
  let acc: Formula = aggs[0]
  for (let i = 1; i < aggs.length; i++) {
    acc = { op: 'add', left: acc, right: aggs[i] }
  }
  return acc
}

/* ──────────────────────── Standard tiles ──────────────────────── */

const STANDARD_REVENUE: CatalogEntry = {
  catalog_key: 'std_lifetime_revenue',
  display_name: 'Total Lifetime Revenue',
  description: 'Sum of all collected revenue across the client\'s files. Lifetime — ignores timeframe picker.',
  category: 'standard',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    {
      id: 'revenue',
      label: 'Revenue source(s)',
      hint: 'Pick the column(s) holding cash collected. Add multiple sources if revenue lives in more than one sheet.',
      agg_op: 'sum',
      repeatable: true,
    },
  ],
  build: (state) => {
    const sources = asList(state.revenue)
    if (sources.length === 0) return null
    return sumAggs(sources.map((s) => makeAgg(s, 'sum')))
  },
}

const STANDARD_CALLS_BOOKED: CatalogEntry = {
  catalog_key: 'std_lifetime_calls_booked',
  display_name: 'Total Calls Booked',
  description: 'Total calls booked across all sources. Lifetime — ignores timeframe picker.',
  category: 'standard',
  format: 'count',
  viz_type: 'card',
  inputs: [
    {
      id: 'calls',
      label: 'Calls booked source(s)',
      hint: 'Pick a count column, or use a row-count column. Add multiple sources if needed.',
      agg_op: 'sum',
      repeatable: true,
    },
  ],
  build: (state) => {
    const sources = asList(state.calls)
    if (sources.length === 0) return null
    return sumAggs(sources.map((s) => makeAgg(s, 'sum')))
  },
}

const STANDARD_CONVERSION_RATE: CatalogEntry = {
  catalog_key: 'std_lifetime_conversion_rate',
  display_name: 'Total Conversion Rate',
  description: 'Lifetime conversion rate. Pick which conversion you want to track at setup.',
  category: 'standard',
  format: 'percent',
  viz_type: 'card',
  variants: [
    {
      id: 'lead_to_close',
      label: 'Lead → Close (closes / leads)',
      description: 'What share of all leads become closed deals.',
      inputs: [
        { id: 'closes', label: 'Closes / sales source(s)', agg_op: 'sum', repeatable: true },
        { id: 'leads', label: 'Leads / opt-ins source(s)', agg_op: 'sum', repeatable: true },
      ],
      build: (state) => {
        const numAggs = asList(state.closes).map((s) => makeAgg(s, 'sum'))
        const denAggs = asList(state.leads).map((s) => makeAgg(s, 'sum'))
        const numerator = sumAggs(numAggs)
        const denominator = sumAggs(denAggs)
        if (!numerator || !denominator) return null
        return { op: 'divide', numerator, denominator }
      },
    },
    {
      id: 'book_to_close',
      label: 'Book → Close (closes / calls booked)',
      description: 'What share of booked calls turn into closes.',
      inputs: [
        { id: 'closes', label: 'Closes / sales source(s)', agg_op: 'sum', repeatable: true },
        { id: 'calls', label: 'Calls booked source(s)', agg_op: 'sum', repeatable: true },
      ],
      build: (state) => {
        const numAggs = asList(state.closes).map((s) => makeAgg(s, 'sum'))
        const denAggs = asList(state.calls).map((s) => makeAgg(s, 'sum'))
        const numerator = sumAggs(numAggs)
        const denominator = sumAggs(denAggs)
        if (!numerator || !denominator) return null
        return { op: 'divide', numerator, denominator }
      },
    },
    {
      id: 'show_to_close',
      label: 'Show → Close (closes / calls showed)',
      description: 'What share of attended calls close. (Same numerator/denominator as the Close Rate KPI.)',
      inputs: [
        { id: 'closes', label: 'Closes / sales source(s)', agg_op: 'sum', repeatable: true },
        { id: 'shows', label: 'Calls showed source(s)', agg_op: 'sum', repeatable: true },
      ],
      build: (state) => {
        const numAggs = asList(state.closes).map((s) => makeAgg(s, 'sum'))
        const denAggs = asList(state.shows).map((s) => makeAgg(s, 'sum'))
        const numerator = sumAggs(numAggs)
        const denominator = sumAggs(denAggs)
        if (!numerator || !denominator) return null
        return { op: 'divide', numerator, denominator }
      },
    },
  ],
}

/* ──────────────────────── Customizable catalog ──────────────────────── */

const AMOUNT_SPENT: CatalogEntry = {
  catalog_key: 'amount_spent',
  display_name: 'Amount Spent',
  description: 'Total ad spend in the selected period. Map to the spend column of the report you want this tile to track.',
  category: 'paid_media',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', hint: 'e.g. "Amount Spent" / "Cost"', agg_op: 'sum' },
  ],
  build: (state) => {
    const s = asSingle(state.spend)
    if (!s) return null
    return makeAgg(s, 'sum')
  },
}

const CPM: CatalogEntry = {
  catalog_key: 'cpm',
  display_name: 'CPM',
  description: 'Cost per 1,000 impressions: (spend / impressions) × 1000.',
  category: 'paid_media',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum' },
    { id: 'impressions', label: 'Impressions column', agg_op: 'sum' },
  ],
  build: (state) => {
    const spend = asSingle(state.spend)
    const imps = asSingle(state.impressions)
    if (!spend || !imps) return null
    return {
      op: 'multiply',
      left: { op: 'divide', numerator: makeAgg(spend, 'sum'), denominator: makeAgg(imps, 'sum') },
      right: { op: 'const', value: 1000 },
    }
  },
}

const OPT_INS: CatalogEntry = {
  catalog_key: 'opt_ins',
  display_name: 'Opt-ins',
  description: 'Total opt-ins / new leads in the selected period.',
  category: 'funnel',
  format: 'count',
  viz_type: 'card',
  inputs: [
    { id: 'optins', label: 'Opt-ins column', hint: 'A count column, or a column you sum to get the total.', agg_op: 'sum' },
  ],
  build: (state) => {
    const s = asSingle(state.optins)
    if (!s) return null
    return makeAgg(s, 'sum')
  },
}

const QUALIFIED_LEADS: CatalogEntry = {
  catalog_key: 'qualified_leads',
  display_name: 'Qualified Leads',
  description: 'Leads that passed your qualification step. Add a filter to scope to qualified rows if needed.',
  category: 'funnel',
  format: 'count',
  viz_type: 'card',
  inputs: [
    { id: 'qualified', label: 'Qualified leads column', agg_op: 'sum', filterable: true },
  ],
  build: (state) => {
    const s = asSingle(state.qualified)
    if (!s) return null
    return makeAgg(s, 'sum')
  },
}

const UNQUALIFIED_LEADS: CatalogEntry = {
  catalog_key: 'unqualified_leads',
  display_name: 'Unqualified Leads',
  description: 'Leads that did not qualify. Map either a dedicated column, or use a filter to count the negative case.',
  category: 'funnel',
  format: 'count',
  viz_type: 'card',
  inputs: [
    { id: 'unqualified', label: 'Unqualified leads column', agg_op: 'sum', filterable: true },
  ],
  build: (state) => {
    const s = asSingle(state.unqualified)
    if (!s) return null
    return makeAgg(s, 'sum')
  },
}

const COST_PER_QUALIFIED_LEAD: CatalogEntry = {
  catalog_key: 'cost_per_qualified_lead',
  display_name: 'Cost per Qualified Lead',
  description: 'Ad spend divided by qualified leads.',
  category: 'paid_media',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum' },
    { id: 'qualified', label: 'Qualified leads column', agg_op: 'sum', filterable: true },
  ],
  build: (state) => {
    const spend = asSingle(state.spend)
    const qual = asSingle(state.qualified)
    if (!spend || !qual) return null
    return { op: 'divide', numerator: makeAgg(spend, 'sum'), denominator: makeAgg(qual, 'sum') }
  },
}

const TOTAL_BLENDED_COST: CatalogEntry = {
  catalog_key: 'total_blended_cost',
  display_name: 'Total Blended Cost',
  description: 'Sum of ad spend across all platforms / sources. Add one row per platform.',
  category: 'paid_media',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    {
      id: 'spend_sources',
      label: 'Spend sources',
      hint: 'Add one entry per ad platform (Meta, Google, etc).',
      agg_op: 'sum',
      repeatable: true,
    },
  ],
  build: (state) => {
    const sources = asList(state.spend_sources)
    if (sources.length === 0) return null
    return sumAggs(sources.map((s) => makeAgg(s, 'sum')))
  },
}

const QUALIFIED_RATIO: CatalogEntry = {
  catalog_key: 'qualified_ratio',
  display_name: 'Qualified vs Unqualified Ratio',
  description: 'Qualified leads divided by unqualified leads.',
  category: 'funnel',
  format: 'ratio',
  viz_type: 'card',
  inputs: [
    { id: 'qualified', label: 'Qualified leads column', agg_op: 'sum', filterable: true },
    { id: 'unqualified', label: 'Unqualified leads column', agg_op: 'sum', filterable: true },
  ],
  build: (state) => {
    const q = asSingle(state.qualified)
    const u = asSingle(state.unqualified)
    if (!q || !u) return null
    return { op: 'divide', numerator: makeAgg(q, 'sum'), denominator: makeAgg(u, 'sum') }
  },
}

const COST_QUAL_PER_BOOKED: CatalogEntry = {
  catalog_key: 'cost_qualified_per_booked',
  display_name: 'Cost (Qualified Leads) per Booked Call',
  description: 'Ad spend that produced qualified leads, divided by booked calls. Map spend to the qualified-lead-driving spend column (or all spend if attribution is blended).',
  category: 'paid_media',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum', filterable: true },
    { id: 'calls_booked', label: 'Calls booked column', agg_op: 'sum' },
  ],
  build: (state) => {
    const spend = asSingle(state.spend)
    const calls = asSingle(state.calls_booked)
    if (!spend || !calls) return null
    return { op: 'divide', numerator: makeAgg(spend, 'sum'), denominator: makeAgg(calls, 'sum') }
  },
}

const SHOW_RATE: CatalogEntry = {
  catalog_key: 'show_rate',
  display_name: 'Show Rate',
  description: 'Calls showed / calls booked.',
  category: 'funnel',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'shows', label: 'Calls showed column', agg_op: 'sum' },
    { id: 'booked', label: 'Calls booked column', agg_op: 'sum' },
  ],
  build: (state) => {
    const sh = asSingle(state.shows)
    const bk = asSingle(state.booked)
    if (!sh || !bk) return null
    return { op: 'divide', numerator: makeAgg(sh, 'sum'), denominator: makeAgg(bk, 'sum') }
  },
}

const CLOSE_RATE: CatalogEntry = {
  catalog_key: 'close_rate',
  display_name: 'Close Rate',
  description: 'Closes / calls showed.',
  category: 'sales',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'closes', label: 'Closes column', agg_op: 'sum' },
    { id: 'shows', label: 'Calls showed column', agg_op: 'sum' },
  ],
  build: (state) => {
    const cl = asSingle(state.closes)
    const sh = asSingle(state.shows)
    if (!cl || !sh) return null
    return { op: 'divide', numerator: makeAgg(cl, 'sum'), denominator: makeAgg(sh, 'sum') }
  },
}

const CASH_COLLECTED: CatalogEntry = {
  catalog_key: 'cash_collected',
  display_name: 'Cash Collected',
  description: 'Total cash collected in the selected period.',
  category: 'sales',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'cash', label: 'Cash collected column', agg_op: 'sum' },
  ],
  build: (state) => {
    const s = asSingle(state.cash)
    if (!s) return null
    return makeAgg(s, 'sum')
  },
}

const PITCH_CLOSE_RATE: CatalogEntry = {
  catalog_key: 'pitch_close_rate',
  display_name: 'Conversion Rate (Leads Present at Pitch)',
  description: 'Closes divided by the leads who were present at the time of the pitch (e.g. webinar attendees who stayed past the offer slide).',
  category: 'sales',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'closes', label: 'Closes column', agg_op: 'sum' },
    { id: 'pitch_attendees', label: 'Leads present at pitch column', hint: 'Often a separate column you log on the webinar / pitch report.', agg_op: 'sum', filterable: true },
  ],
  build: (state) => {
    const cl = asSingle(state.closes)
    const pa = asSingle(state.pitch_attendees)
    if (!cl || !pa) return null
    return { op: 'divide', numerator: makeAgg(cl, 'sum'), denominator: makeAgg(pa, 'sum') }
  },
}

/* ──────────────────────── Exports ──────────────────────── */

export const STANDARD_CATALOG: CatalogEntry[] = [
  STANDARD_REVENUE,
  STANDARD_CALLS_BOOKED,
  STANDARD_CONVERSION_RATE,
]

export const CUSTOMIZABLE_CATALOG: CatalogEntry[] = [
  AMOUNT_SPENT,
  CPM,
  OPT_INS,
  QUALIFIED_LEADS,
  UNQUALIFIED_LEADS,
  COST_PER_QUALIFIED_LEAD,
  TOTAL_BLENDED_COST,
  QUALIFIED_RATIO,
  COST_QUAL_PER_BOOKED,
  SHOW_RATE,
  CLOSE_RATE,
  CASH_COLLECTED,
  PITCH_CLOSE_RATE,
]

export const ALL_CATALOG: CatalogEntry[] = [
  ...STANDARD_CATALOG,
  ...CUSTOMIZABLE_CATALOG,
]

export function getCatalogEntry(catalogKey: string): CatalogEntry | null {
  return ALL_CATALOG.find((e) => e.catalog_key === catalogKey) ?? null
}

export const STANDARD_CATALOG_KEYS = new Set(STANDARD_CATALOG.map((e) => e.catalog_key))

export function isStandardKey(key: string): boolean {
  return STANDARD_CATALOG_KEYS.has(key)
}
