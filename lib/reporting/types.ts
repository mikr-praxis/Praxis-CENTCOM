/**
 * KPI formula DSL — JSON expression tree, evaluated by lib/reporting/engine.ts.
 * No `eval`, no string formulas. All operations are validated server-side.
 */

import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

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
}

export interface RawFileForEngine {
  filename: string
  columns: string[]
  rows: Record<string, unknown>[]
}
