/**
 * KPI formula DSL — JSON expression tree, evaluated by lib/reporting/engine.ts.
 * No `eval`, no string formulas. All operations are validated server-side.
 */

import type { KPIFormat, KPIVizType, ChartOptions } from '@/lib/supabase/types'

/** A global slicer applied to KPIs whose source file contains the column. */
export interface Slicer {
  filename: string
  column: string
  /** When non-empty, KPIs filter to rows where column ∈ values. */
  values: string[]
}

export type Comparator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'not_empty' | 'empty'

export interface Filter {
  column: string
  op: Comparator
  /** Value(s) for the comparator. Strings are compared case-insensitively for eq/neq/contains. */
  value?: string | number | (string | number)[]
}

/** Column-level aggregations. */
export interface AggOp {
  op: 'sum' | 'count' | 'count_distinct' | 'avg' | 'min' | 'max'
  /** Source filename in report_raw_files. Match by exact filename. Ignored
   *  when `all_files` is true OR when `source_type` is set (external fact
   *  rows are addressed by `source_type`+`kind`, not by filename). */
  source: string
  /** External data source discriminator. Unset = Drive-backed AggOp,
   *  evaluated against report_raw_files (existing path). Set = facts-backed
   *  AggOp, evaluated against report_external_facts via SQL filters on
   *  (client_id, source_type, kind). Examples: 'posthog', 'stripe',
   *  'meta_ads'. See content/memory/kpi-data-sources-plan.md. */
  source_type?: string
  /** Logical metric name within the source — required when source_type is set.
   *  Maps to the `kind` column on report_external_facts. Examples: 'opt_ins',
   *  'cash_collected', 'amount_spent'. */
  kind?: string
  /** Column to aggregate. Required for sum/avg/min/max/count_distinct. Optional for count (= row count).
   *  For source_type-backed AggOps, defaults to 'value' (the numeric column on report_external_facts);
   *  may also reference a key inside the dimensions JSONB. */
  column?: string
  /** Optional row filters (AND'd together). */
  filters?: Filter[]
  /** Date column to apply timeframe filtering against. Required if timeframe filtering is desired.
   *  For source_type-backed AggOps, this is conventionally 'ts'. */
  timeframe_column?: string
  /** When true, the evaluator aggregates `column` across EVERY synced file
   *  that has it (or every file, for plain `count`). Used by the standard
   *  lifetime tiles so the user can pick one column and have the engine
   *  pull from the entire Drive folder. Supported ops: sum, count,
   *  count_distinct. avg/min/max in this mode operate on the union of
   *  values, not per-file averages. Ignored when source_type is set. */
  all_files?: boolean
}

/** Composite operations between sub-expressions. */
export interface CompositeOp {
  op: 'divide' | 'subtract' | 'multiply' | 'add'
  numerator?: Formula
  denominator?: Formula
  left?: Formula
  right?: Formula
}

/** Constant literal (for embedding fixed multipliers etc.). */
export interface ConstOp {
  op: 'const'
  value: number
}

export type Formula = AggOp | CompositeOp | ConstOp

export interface Timeframe {
  /** ISO date strings (yyyy-mm-dd or full ISO). Inclusive on both ends. */
  start: string | null
  end: string | null
}

export interface KPIDefinition {
  id: string
  client_id: string | null
  key: string
  display_name: string
  description: string | null
  formula: Formula
  format: KPIFormat
  target: number | null
  viz_type: KPIVizType
  display_order: number
  /** Optional: column to break the KPI down by (returns one value per distinct group). */
  group_by_column?: string | null
  /** Source file for the group_by_column (must match formula's source for AggOp). */
  group_by_source?: string | null
  /** Optional: comparison mode for delta vs prior period. */
  compare_to?: 'previous_period' | 'previous_year' | null
  /** Optional: number of future periods to forecast (0 = no forecast). */
  forecast_periods?: number
  /** Optional: forecast algorithm. */
  forecast_method?: 'linear' | 'moving_avg' | null
  /** Per-chart customization. */
  chart_options?: ChartOptions
}

export interface KPIResult {
  kpi_id: string
  key: string
  display_name: string
  format: KPIFormat
  target: number | null
  viz_type: KPIVizType
  value: number | null
  rows_used: number
  source_files: string[]
  error: string | null
  /** Optional time series for line/bar visualizations. */
  series?: { bucket: string; value: number | null }[]
  /** Optional forecasted future points (continuation of series, dashed in UI). */
  forecast?: { bucket: string; value: number | null }[]
  /** Period-over-period comparison: prior-period value + delta. */
  compare?: {
    previous_value: number | null
    delta_absolute: number | null
    delta_percent: number | null
  } | null
  /** Group-by breakdown: top-N (group, value) pairs. */
  groups?: { group: string; value: number | null; rows_used: number }[]
  /** Per-chart customization carried through from the KPI definition. */
  chart_options?: ChartOptions
}

export interface RawFileForEngine {
  filename: string
  columns: string[]
  rows: Record<string, unknown>[]
}
