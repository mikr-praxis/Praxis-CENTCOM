/**
 * KPI formula DSL — JSON expression tree, evaluated by lib/reporting/engine.ts.
 * No `eval`, no string formulas. All operations are validated server-side.
 */

import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

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

/** Column-level aggregations (single source file). */
export interface AggOp {
  op: 'sum' | 'count' | 'count_distinct' | 'avg' | 'min' | 'max'
  /** Source filename in report_raw_files. Match by exact filename. */
  source: string
  /** Column to aggregate. Required for sum/avg/min/max/count_distinct. Optional for count (= row count). */
  column?: string
  /** Optional row filters (AND'd together). */
  filters?: Filter[]
  /** Date column to apply timeframe filtering against. Required if timeframe filtering is desired. */
  timeframe_column?: string
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
}

export interface RawFileForEngine {
  filename: string
  columns: string[]
  rows: Record<string, unknown>[]
}
