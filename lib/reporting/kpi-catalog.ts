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
import type { CanonicalMetric, DetectedColumns } from './auto-detect'

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
  /** Sub-grouping for the Standard tiles UI: volumes / costs / rates / averages.
   *  Only set on `category === 'standard'` entries. */
  std_group?: 'volumes' | 'costs' | 'rates' | 'averages'
  format: KPIFormat
  viz_type: KPIVizType
  /** Either a flat input list OR variants (mutually exclusive). */
  inputs?: CatalogInput[]
  variants?: CatalogVariant[]
  /** Formula builder for the flat case. Variants override this. */
  build?: (state: Record<string, CatalogInputValue>) => Formula | null
  /** Zero-config formula builder. When present, the /standard-tiles route uses
   *  this to compose a Formula from auto-detected canonical column names —
   *  no user setup required. Returns null when one of the required canonical
   *  metrics couldn't be detected, in which case the tile renders as "—".
   *  Only set on standard tiles. */
  auto_build?: (detected: DetectedColumns) => {
    formula: Formula
    used: CanonicalMetric[]
  } | null
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

/* ──────────────────────── Auto-build helpers (zero-config) ──────────────────────── */

/** Build an `all_files: true` sum of a column. */
function allFilesSum(column: string): AggOp {
  return { op: 'sum', source: '*', column, all_files: true }
}

/** Build a divide(num, den) formula. */
function divide(num: Formula, den: Formula): Formula {
  return { op: 'divide', numerator: num, denominator: den }
}

/** Helper: compose an auto_build that requires all listed metrics, sums the
 *  first one (for "totals" tiles like spend/leads/etc). */
function autoSumOf(metric: CanonicalMetric) {
  return (detected: DetectedColumns) => {
    const col = detected[metric]
    if (!col) return null
    return { formula: allFilesSum(col), used: [metric] }
  }
}

/** Helper: compose an auto_build for ratio tiles (numerator / denominator). */
function autoRatioOf(num: CanonicalMetric, den: CanonicalMetric) {
  return (detected: DetectedColumns) => {
    const numCol = detected[num]
    const denCol = detected[den]
    if (!numCol || !denCol) return null
    return {
      formula: divide(allFilesSum(numCol), allFilesSum(denCol)),
      used: [num, den],
    }
  }
}

/* ──────────────────────── Standard tiles ──────────────────────── */

/* Standard tiles — the always-on, zero-config tiles at the top of the client
 * view. Each has both:
 *   - a `build()` for the manual "Configure" modal (existing override path),
 *   - an `auto_build()` that turns auto-detected canonical columns into a
 *     Formula with no user input. The /standard-tiles route prefers any
 *     existing override row, falling back to auto_build.
 */

// Volumes
const STANDARD_SPEND: CatalogEntry = {
  catalog_key: 'std_lifetime_spend',
  display_name: 'Total Spend',
  description: 'Lifetime ad spend, summed across every synced Drive file that has a spend column.',
  category: 'standard',
  std_group: 'volumes',
  format: 'currency',
  viz_type: 'card',
  inputs: [{ id: 'spend', label: 'Spend column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.spend)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('spend'),
}

const STANDARD_LEADS: CatalogEntry = {
  catalog_key: 'std_lifetime_leads',
  display_name: 'Total Leads',
  description: 'Total opt-ins / leads. Summed across every synced file that has the column.',
  category: 'standard',
  std_group: 'volumes',
  format: 'count',
  viz_type: 'card',
  inputs: [{ id: 'leads', label: 'Leads column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.leads)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('leads'),
}

const STANDARD_CALLS_BOOKED: CatalogEntry = {
  catalog_key: 'std_lifetime_calls_booked',
  display_name: 'Total Calls Booked',
  description: 'Lifetime calls booked, summed across every synced Drive file.',
  category: 'standard',
  std_group: 'volumes',
  format: 'count',
  viz_type: 'card',
  inputs: [{ id: 'calls', label: 'Calls booked column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.calls)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('calls_booked'),
}

const STANDARD_CALLS_SHOWED: CatalogEntry = {
  catalog_key: 'std_lifetime_calls_showed',
  display_name: 'Total Calls Showed',
  description: 'Lifetime calls showed / attended.',
  category: 'standard',
  std_group: 'volumes',
  format: 'count',
  viz_type: 'card',
  inputs: [{ id: 'shows', label: 'Calls showed column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.shows)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('calls_showed'),
}

const STANDARD_CLOSES: CatalogEntry = {
  catalog_key: 'std_lifetime_closes',
  display_name: 'Total Closes',
  description: 'Lifetime closed deals / sales.',
  category: 'standard',
  std_group: 'volumes',
  format: 'count',
  viz_type: 'card',
  inputs: [{ id: 'closes', label: 'Closes column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.closes)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('closes'),
}

const STANDARD_REVENUE: CatalogEntry = {
  catalog_key: 'std_lifetime_revenue',
  display_name: 'Total Revenue',
  description: 'Lifetime revenue, summed across every synced Drive file that has a revenue column.',
  category: 'standard',
  std_group: 'volumes',
  format: 'currency',
  viz_type: 'card',
  inputs: [{ id: 'revenue', label: 'Revenue column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.revenue)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('revenue'),
}

const STANDARD_CASH_COLLECTED: CatalogEntry = {
  catalog_key: 'std_lifetime_cash_collected',
  display_name: 'Total Cash Collected',
  description: 'Lifetime cash actually collected (vs contracted revenue).',
  category: 'standard',
  std_group: 'volumes',
  format: 'currency',
  viz_type: 'card',
  inputs: [{ id: 'cash', label: 'Cash collected column', agg_op: 'sum', scope: 'all_files' }],
  build: (state) => {
    const s = asSingle(state.cash)
    return s?.column ? makeAllFilesAgg(s, 'sum') : null
  },
  auto_build: autoSumOf('cash_collected'),
}

// Costs
const STANDARD_CPL: CatalogEntry = {
  catalog_key: 'std_lifetime_cpl',
  display_name: 'CPL',
  description: 'Cost per lead — lifetime spend ÷ leads.',
  category: 'standard',
  std_group: 'costs',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum', scope: 'all_files' },
    { id: 'leads', label: 'Leads column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const sp = asSingle(state.spend)
    const ld = asSingle(state.leads)
    if (!sp?.column || !ld?.column) return null
    return divide(makeAllFilesAgg(sp, 'sum'), makeAllFilesAgg(ld, 'sum'))
  },
  auto_build: autoRatioOf('spend', 'leads'),
}

const STANDARD_CPB: CatalogEntry = {
  catalog_key: 'std_lifetime_cpb',
  display_name: 'Cost per Booking',
  description: 'Spend ÷ calls booked.',
  category: 'standard',
  std_group: 'costs',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum', scope: 'all_files' },
    { id: 'calls', label: 'Calls booked column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const sp = asSingle(state.spend)
    const cb = asSingle(state.calls)
    if (!sp?.column || !cb?.column) return null
    return divide(makeAllFilesAgg(sp, 'sum'), makeAllFilesAgg(cb, 'sum'))
  },
  auto_build: autoRatioOf('spend', 'calls_booked'),
}

const STANDARD_CPS: CatalogEntry = {
  catalog_key: 'std_lifetime_cps',
  display_name: 'Cost per Show',
  description: 'Spend ÷ calls showed.',
  category: 'standard',
  std_group: 'costs',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum', scope: 'all_files' },
    { id: 'shows', label: 'Calls showed column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const sp = asSingle(state.spend)
    const sh = asSingle(state.shows)
    if (!sp?.column || !sh?.column) return null
    return divide(makeAllFilesAgg(sp, 'sum'), makeAllFilesAgg(sh, 'sum'))
  },
  auto_build: autoRatioOf('spend', 'calls_showed'),
}

const STANDARD_CPA: CatalogEntry = {
  catalog_key: 'std_lifetime_cpa',
  display_name: 'CPA',
  description: 'Cost per acquisition — spend ÷ closes.',
  category: 'standard',
  std_group: 'costs',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'spend', label: 'Spend column', agg_op: 'sum', scope: 'all_files' },
    { id: 'closes', label: 'Closes column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const sp = asSingle(state.spend)
    const cl = asSingle(state.closes)
    if (!sp?.column || !cl?.column) return null
    return divide(makeAllFilesAgg(sp, 'sum'), makeAllFilesAgg(cl, 'sum'))
  },
  auto_build: autoRatioOf('spend', 'closes'),
}

const STANDARD_ROAS: CatalogEntry = {
  catalog_key: 'std_lifetime_roas',
  display_name: 'ROAS',
  description: 'Return on ad spend — revenue ÷ spend.',
  category: 'standard',
  std_group: 'costs',
  format: 'ratio',
  viz_type: 'card',
  inputs: [
    { id: 'revenue', label: 'Revenue column', agg_op: 'sum', scope: 'all_files' },
    { id: 'spend', label: 'Spend column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const rv = asSingle(state.revenue)
    const sp = asSingle(state.spend)
    if (!rv?.column || !sp?.column) return null
    return divide(makeAllFilesAgg(rv, 'sum'), makeAllFilesAgg(sp, 'sum'))
  },
  auto_build: autoRatioOf('revenue', 'spend'),
}

// Rates
const STANDARD_BOOKING_RATE: CatalogEntry = {
  catalog_key: 'std_lifetime_booking_rate',
  display_name: 'Booking Rate',
  description: 'Calls booked ÷ leads.',
  category: 'standard',
  std_group: 'rates',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'calls', label: 'Calls booked column', agg_op: 'sum', scope: 'all_files' },
    { id: 'leads', label: 'Leads column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const cb = asSingle(state.calls)
    const ld = asSingle(state.leads)
    if (!cb?.column || !ld?.column) return null
    return divide(makeAllFilesAgg(cb, 'sum'), makeAllFilesAgg(ld, 'sum'))
  },
  auto_build: autoRatioOf('calls_booked', 'leads'),
}

const STANDARD_SHOW_RATE: CatalogEntry = {
  catalog_key: 'std_lifetime_show_rate',
  display_name: 'Show Rate',
  description: 'Calls showed ÷ calls booked.',
  category: 'standard',
  std_group: 'rates',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'shows', label: 'Calls showed column', agg_op: 'sum', scope: 'all_files' },
    { id: 'calls', label: 'Calls booked column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const sh = asSingle(state.shows)
    const cb = asSingle(state.calls)
    if (!sh?.column || !cb?.column) return null
    return divide(makeAllFilesAgg(sh, 'sum'), makeAllFilesAgg(cb, 'sum'))
  },
  auto_build: autoRatioOf('calls_showed', 'calls_booked'),
}

const STANDARD_CLOSE_RATE: CatalogEntry = {
  catalog_key: 'std_lifetime_close_rate',
  display_name: 'Close Rate',
  description: 'Closes ÷ calls showed.',
  category: 'standard',
  std_group: 'rates',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'closes', label: 'Closes column', agg_op: 'sum', scope: 'all_files' },
    { id: 'shows', label: 'Calls showed column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const cl = asSingle(state.closes)
    const sh = asSingle(state.shows)
    if (!cl?.column || !sh?.column) return null
    return divide(makeAllFilesAgg(cl, 'sum'), makeAllFilesAgg(sh, 'sum'))
  },
  auto_build: autoRatioOf('closes', 'calls_showed'),
}

const STANDARD_CONVERSION_RATE: CatalogEntry = {
  catalog_key: 'std_lifetime_conversion_rate',
  display_name: 'Lead → Close Rate',
  description: 'End-to-end conversion: closes ÷ leads.',
  category: 'standard',
  std_group: 'rates',
  format: 'percent',
  viz_type: 'card',
  inputs: [
    { id: 'closes', label: 'Closes column', agg_op: 'sum', scope: 'all_files' },
    { id: 'leads', label: 'Leads column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const cl = asSingle(state.closes)
    const ld = asSingle(state.leads)
    if (!cl?.column || !ld?.column) return null
    return divide(makeAllFilesAgg(cl, 'sum'), makeAllFilesAgg(ld, 'sum'))
  },
  auto_build: autoRatioOf('closes', 'leads'),
}

// Averages
const STANDARD_AOV: CatalogEntry = {
  catalog_key: 'std_lifetime_aov',
  display_name: 'AOV',
  description: 'Average order value — revenue ÷ closes.',
  category: 'standard',
  std_group: 'averages',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'revenue', label: 'Revenue column', agg_op: 'sum', scope: 'all_files' },
    { id: 'closes', label: 'Closes column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const rv = asSingle(state.revenue)
    const cl = asSingle(state.closes)
    if (!rv?.column || !cl?.column) return null
    return divide(makeAllFilesAgg(rv, 'sum'), makeAllFilesAgg(cl, 'sum'))
  },
  auto_build: autoRatioOf('revenue', 'closes'),
}

const STANDARD_CASH_PER_CLOSE: CatalogEntry = {
  catalog_key: 'std_lifetime_cash_per_close',
  display_name: 'Cash per Close',
  description: 'Cash collected ÷ closes — what each closed deal actually paid.',
  category: 'standard',
  std_group: 'averages',
  format: 'currency',
  viz_type: 'card',
  inputs: [
    { id: 'cash', label: 'Cash collected column', agg_op: 'sum', scope: 'all_files' },
    { id: 'closes', label: 'Closes column', agg_op: 'sum', scope: 'all_files' },
  ],
  build: (state) => {
    const ca = asSingle(state.cash)
    const cl = asSingle(state.closes)
    if (!ca?.column || !cl?.column) return null
    return divide(makeAllFilesAgg(ca, 'sum'), makeAllFilesAgg(cl, 'sum'))
  },
  auto_build: autoRatioOf('cash_collected', 'closes'),
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
  STANDARD_CONVERSION_RATE,
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
