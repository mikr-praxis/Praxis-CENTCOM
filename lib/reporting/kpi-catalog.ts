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
  /** Aggregation scope.
   *  - `'file'` (default): user picks a specific source file + column.
   *  - `'all_files'`: user picks ONLY a column name; engine pulls the column
   *    from every synced file in the Drive folder that contains it. Used by
   *    the standard lifetime tiles so setup is one column-pick, not one per
   *    file. */
  scope?: 'file' | 'all_files'
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
  /** Sub-grouping for the Standard tiles UI (only on category === 'standard'). */
  std_group?: 'volumes' | 'costs' | 'rates' | 'averages'
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

/** Build an `all_files` AggOp — engine aggregates the column across every
 *  synced file that has it. Used by the standard lifetime tiles. */
function makeAllFilesAgg(s: CatalogInputState, op: CatalogInput['agg_op']): AggOp {
  return {
    op,
    source: '*', // ignored when all_files is true; kept for type safety
    column: s.column,
    all_files: true,
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

/* Standard tiles are mapped automatically by the AI mapper at
 * /api/reporting/[slug]/standard-tiles. The `inputs` + `build` here are only
 * used by the manual-override path (KPIConfigModal opened via the gear icon)
 * — they let the user pick a column by hand when the AI got it wrong.
 *
 * Display order in this array = render order in the StandardKPITiles UI.
 */

/** Single-column "sum across all files" tile (volumes). */
function stdSumTile(args: {
  key: string
  display_name: string
  description: string
  std_group: 'volumes'
  format: KPIFormat
  inputId: string
  inputLabel: string
}): CatalogEntry {
  return {
    catalog_key: args.key,
    display_name: args.display_name,
    description: args.description,
    category: 'standard',
    std_group: args.std_group,
    format: args.format,
    viz_type: 'card',
    inputs: [
      { id: args.inputId, label: args.inputLabel, agg_op: 'sum', scope: 'all_files' },
    ],
    build: (state) => {
      const s = asSingle(state[args.inputId])
      return s?.column ? makeAllFilesAgg(s, 'sum') : null
    },
  }
}

/** Two-column ratio tile (costs/rates/averages). */
function stdRatioTile(args: {
  key: string
  display_name: string
  description: string
  std_group: 'costs' | 'rates' | 'averages'
  format: KPIFormat
  numId: string
  numLabel: string
  denId: string
  denLabel: string
}): CatalogEntry {
  return {
    catalog_key: args.key,
    display_name: args.display_name,
    description: args.description,
    category: 'standard',
    std_group: args.std_group,
    format: args.format,
    viz_type: 'card',
    inputs: [
      { id: args.numId, label: args.numLabel, agg_op: 'sum', scope: 'all_files' },
      { id: args.denId, label: args.denLabel, agg_op: 'sum', scope: 'all_files' },
    ],
    build: (state) => {
      const num = asSingle(state[args.numId])
      const den = asSingle(state[args.denId])
      if (!num?.column || !den?.column) return null
      return {
        op: 'divide',
        numerator: makeAllFilesAgg(num, 'sum'),
        denominator: makeAllFilesAgg(den, 'sum'),
      }
    },
  }
}

// Volumes (7 tiles)
const STANDARD_SPEND = stdSumTile({
  key: 'std_lifetime_spend', display_name: 'Total Spend',
  description: 'Lifetime ad spend across every synced file.',
  std_group: 'volumes', format: 'currency',
  inputId: 'spend', inputLabel: 'Spend column',
})
const STANDARD_LEADS = stdSumTile({
  key: 'std_lifetime_leads', display_name: 'Total Leads',
  description: 'Lifetime leads / opt-ins across every synced file.',
  std_group: 'volumes', format: 'count',
  inputId: 'leads', inputLabel: 'Leads / opt-ins column',
})
const STANDARD_CALLS_BOOKED = stdSumTile({
  key: 'std_lifetime_calls_booked', display_name: 'Total Calls Booked',
  description: 'Lifetime calls booked across every synced file.',
  std_group: 'volumes', format: 'count',
  inputId: 'calls', inputLabel: 'Calls booked column',
})
const STANDARD_CALLS_SHOWED = stdSumTile({
  key: 'std_lifetime_calls_showed', display_name: 'Total Calls Showed',
  description: 'Lifetime calls showed / attended.',
  std_group: 'volumes', format: 'count',
  inputId: 'shows', inputLabel: 'Calls showed column',
})
const STANDARD_CLOSES = stdSumTile({
  key: 'std_lifetime_closes', display_name: 'Total Closes',
  description: 'Lifetime closed deals.',
  std_group: 'volumes', format: 'count',
  inputId: 'closes', inputLabel: 'Closes column',
})
const STANDARD_REVENUE = stdSumTile({
  key: 'std_lifetime_revenue', display_name: 'Total Revenue',
  description: 'Lifetime contracted revenue across every synced file.',
  std_group: 'volumes', format: 'currency',
  inputId: 'revenue', inputLabel: 'Revenue column',
})
const STANDARD_CASH_COLLECTED = stdSumTile({
  key: 'std_lifetime_cash_collected', display_name: 'Total Cash Collected',
  description: 'Lifetime cash actually received.',
  std_group: 'volumes', format: 'currency',
  inputId: 'cash', inputLabel: 'Cash collected column',
})

// Costs (5 tiles)
const STANDARD_CPL = stdRatioTile({
  key: 'std_lifetime_cpl', display_name: 'CPL',
  description: 'Cost per lead — spend ÷ leads.',
  std_group: 'costs', format: 'currency',
  numId: 'spend', numLabel: 'Spend column',
  denId: 'leads', denLabel: 'Leads column',
})
const STANDARD_CPB = stdRatioTile({
  key: 'std_lifetime_cpb', display_name: 'Cost per Booking',
  description: 'Spend ÷ calls booked.',
  std_group: 'costs', format: 'currency',
  numId: 'spend', numLabel: 'Spend column',
  denId: 'calls', denLabel: 'Calls booked column',
})
const STANDARD_CPS = stdRatioTile({
  key: 'std_lifetime_cps', display_name: 'Cost per Show',
  description: 'Spend ÷ calls showed.',
  std_group: 'costs', format: 'currency',
  numId: 'spend', numLabel: 'Spend column',
  denId: 'shows', denLabel: 'Calls showed column',
})
const STANDARD_CPA = stdRatioTile({
  key: 'std_lifetime_cpa', display_name: 'CPA',
  description: 'Cost per acquisition — spend ÷ closes.',
  std_group: 'costs', format: 'currency',
  numId: 'spend', numLabel: 'Spend column',
  denId: 'closes', denLabel: 'Closes column',
})
const STANDARD_ROAS = stdRatioTile({
  key: 'std_lifetime_roas', display_name: 'ROAS',
  description: 'Return on ad spend — revenue ÷ spend.',
  std_group: 'costs', format: 'ratio',
  numId: 'revenue', numLabel: 'Revenue column',
  denId: 'spend', denLabel: 'Spend column',
})

// Rates (4 tiles)
const STANDARD_BOOKING_RATE = stdRatioTile({
  key: 'std_lifetime_booking_rate', display_name: 'Booking Rate',
  description: 'Calls booked ÷ leads.',
  std_group: 'rates', format: 'percent',
  numId: 'calls', numLabel: 'Calls booked column',
  denId: 'leads', denLabel: 'Leads column',
})
const STANDARD_SHOW_RATE = stdRatioTile({
  key: 'std_lifetime_show_rate', display_name: 'Show Rate',
  description: 'Calls showed ÷ calls booked.',
  std_group: 'rates', format: 'percent',
  numId: 'shows', numLabel: 'Calls showed column',
  denId: 'calls', denLabel: 'Calls booked column',
})
const STANDARD_CLOSE_RATE = stdRatioTile({
  key: 'std_lifetime_close_rate', display_name: 'Close Rate',
  description: 'Closes ÷ calls showed.',
  std_group: 'rates', format: 'percent',
  numId: 'closes', numLabel: 'Closes column',
  denId: 'shows', denLabel: 'Calls showed column',
})
const STANDARD_LEAD_TO_CLOSE = stdRatioTile({
  key: 'std_lifetime_lead_to_close', display_name: 'Lead → Close',
  description: 'End-to-end conversion — closes ÷ leads.',
  std_group: 'rates', format: 'percent',
  numId: 'closes', numLabel: 'Closes column',
  denId: 'leads', denLabel: 'Leads column',
})

// Averages (2 tiles)
const STANDARD_AOV = stdRatioTile({
  key: 'std_lifetime_aov', display_name: 'AOV',
  description: 'Average order value — revenue ÷ closes.',
  std_group: 'averages', format: 'currency',
  numId: 'revenue', numLabel: 'Revenue column',
  denId: 'closes', denLabel: 'Closes column',
})
const STANDARD_CASH_PER_CLOSE = stdRatioTile({
  key: 'std_lifetime_cash_per_close', display_name: 'Cash per Close',
  description: 'Cash collected ÷ closes.',
  std_group: 'averages', format: 'currency',
  numId: 'cash', numLabel: 'Cash collected column',
  denId: 'closes', denLabel: 'Closes column',
})

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
  // Volumes
  STANDARD_SPEND,
  STANDARD_LEADS,
  STANDARD_CALLS_BOOKED,
  STANDARD_CALLS_SHOWED,
  STANDARD_CLOSES,
  STANDARD_REVENUE,
  STANDARD_CASH_COLLECTED,
  // Costs
  STANDARD_CPL,
  STANDARD_CPB,
  STANDARD_CPS,
  STANDARD_CPA,
  STANDARD_ROAS,
  // Rates
  STANDARD_BOOKING_RATE,
  STANDARD_SHOW_RATE,
  STANDARD_CLOSE_RATE,
  STANDARD_LEAD_TO_CLOSE,
  // Averages
  STANDARD_AOV,
  STANDARD_CASH_PER_CLOSE,
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
