/**
 * KPI formula evaluator. Pure functions — given a formula, the cached raw
 * files, and a timeframe, return a numeric result.
 */

import type {
  Formula,
  AggOp,
  CompositeOp,
  ConstOp,
  Filter,
  Timeframe,
  KPIResult,
  KPIDefinition,
  RawFileForEngine,
} from './types'

interface EvalContext {
  files: RawFileForEngine[]
  timeframe: Timeframe
  rowsUsed: { value: number }
  sourcesUsed: Set<string>
}

function isAggOp(f: Formula): f is AggOp {
  return ['sum', 'count', 'count_distinct', 'avg', 'min', 'max'].includes(
    (f as AggOp).op
  )
}
function isCompositeOp(f: Formula): f is CompositeOp {
  return ['divide', 'subtract', 'multiply', 'add'].includes((f as CompositeOp).op)
}
function isConstOp(f: Formula): f is ConstOp {
  return (f as ConstOp).op === 'const'
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const str = String(value).replace(/[$,\s]/g, '').replace(/%$/, '')
  const n = Number(str)
  return Number.isFinite(n) ? n : null
}

function compareValue(cell: unknown, comparator: Filter['op'], target: Filter['value']): boolean {
  const cellStr = cell == null ? '' : String(cell).trim()
  const cellLower = cellStr.toLowerCase()
  const targetArr = Array.isArray(target) ? target : target == null ? [] : [target]
  const targetStrs = targetArr.map((v) => String(v).toLowerCase())
  const targetNum = toNumber(targetArr[0])
  const cellNum = toNumber(cell)

  switch (comparator) {
    case 'eq':
      return cellLower === targetStrs[0]
    case 'neq':
      return cellLower !== targetStrs[0]
    case 'in':
      return targetStrs.includes(cellLower)
    case 'not_in':
      return !targetStrs.includes(cellLower)
    case 'contains':
      return cellLower.includes(targetStrs[0] ?? '')
    case 'gt':
      return cellNum != null && targetNum != null && cellNum > targetNum
    case 'gte':
      return cellNum != null && targetNum != null && cellNum >= targetNum
    case 'lt':
      return cellNum != null && targetNum != null && cellNum < targetNum
    case 'lte':
      return cellNum != null && targetNum != null && cellNum <= targetNum
    case 'not_empty':
      return cellStr !== ''
    case 'empty':
      return cellStr === ''
  }
}

function rowMatchesFilters(row: Record<string, unknown>, filters: Filter[] | undefined): boolean {
  if (!filters || filters.length === 0) return true
  for (const f of filters) {
    if (!compareValue(row[f.column], f.op, f.value)) return false
  }
  return true
}

function isInTimeframe(row: Record<string, unknown>, column: string | undefined, tf: Timeframe): boolean {
  if (!column) return true
  if (!tf.start && !tf.end) return true
  const raw = row[column]
  if (raw == null || raw === '') return false
  const date = parseLooseDate(String(raw))
  if (!date) return false
  if (tf.start) {
    const s = parseLooseDate(tf.start)
    if (s && date < s) return false
  }
  if (tf.end) {
    const e = parseLooseDate(tf.end)
    if (e) {
      // Make end inclusive: bump to end-of-day if it's a date-only string
      const endTime = tf.end.length <= 10 ? new Date(e.getTime() + 24 * 60 * 60 * 1000 - 1) : e
      if (date > endTime) return false
    }
  }
  return true
}

function parseLooseDate(s: string): Date | null {
  if (!s) return null
  // Try ISO first
  const iso = new Date(s)
  if (!Number.isNaN(iso.getTime())) return iso
  // Try MM/DD/YYYY and similar
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let yr = parseInt(m[3], 10)
    if (yr < 100) yr += 2000
    const dt = new Date(yr, parseInt(m[1], 10) - 1, parseInt(m[2], 10))
    if (!Number.isNaN(dt.getTime())) return dt
  }
  return null
}

function findSource(files: RawFileForEngine[], filename: string): RawFileForEngine | null {
  // Exact filename match first; then case-insensitive; then prefix match.
  let f = files.find((x) => x.filename === filename)
  if (f) return f
  f = files.find((x) => x.filename.toLowerCase() === filename.toLowerCase())
  if (f) return f
  f = files.find((x) => x.filename.toLowerCase().startsWith(filename.toLowerCase()))
  return f ?? null
}

function evaluateAgg(node: AggOp, ctx: EvalContext): number | null {
  const file = findSource(ctx.files, node.source)
  if (!file) return null
  ctx.sourcesUsed.add(file.filename)

  const matching = file.rows.filter(
    (row) =>
      rowMatchesFilters(row, node.filters) && isInTimeframe(row, node.timeframe_column, ctx.timeframe)
  )
  ctx.rowsUsed.value += matching.length

  if (node.op === 'count') return matching.length
  if (node.op === 'count_distinct') {
    if (!node.column) return null
    const seen = new Set<string>()
    for (const row of matching) {
      const v = row[node.column]
      if (v != null && v !== '') seen.add(String(v))
    }
    return seen.size
  }

  if (!node.column) return null
  const values: number[] = []
  for (const row of matching) {
    const n = toNumber(row[node.column])
    if (n != null) values.push(n)
  }
  if (values.length === 0) return node.op === 'sum' ? 0 : null

  switch (node.op) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
  return null
}

function evaluateComposite(node: CompositeOp, ctx: EvalContext): number | null {
  if (node.op === 'divide') {
    const num = node.numerator ? evaluateFormula(node.numerator, ctx) : null
    const den = node.denominator ? evaluateFormula(node.denominator, ctx) : null
    if (num == null || den == null || den === 0) return null
    return num / den
  }
  const left = node.left ? evaluateFormula(node.left, ctx) : null
  const right = node.right ? evaluateFormula(node.right, ctx) : null
  if (left == null || right == null) return null
  switch (node.op) {
    case 'subtract':
      return left - right
    case 'multiply':
      return left * right
    case 'add':
      return left + right
  }
  return null
}

export function evaluateFormula(node: Formula, ctx: EvalContext): number | null {
  if (isConstOp(node)) return node.value
  if (isAggOp(node)) return evaluateAgg(node, ctx)
  if (isCompositeOp(node)) return evaluateComposite(node, ctx)
  return null
}

export type Granularity = 'day' | 'week' | 'month'

export interface SeriesPoint {
  bucket: string // ISO date for the start of the bucket
  value: number | null
}

/**
 * Decide a sensible default granularity based on timeframe span.
 * - Up to 14 days  → daily
 * - Up to 120 days → weekly
 * - Anything bigger → monthly
 */
export function pickGranularity(tf: Timeframe): Granularity {
  if (!tf.start || !tf.end) return 'week'
  const start = new Date(tf.start).getTime()
  const end = new Date(tf.end).getTime()
  const days = Math.max(1, (end - start) / (24 * 60 * 60 * 1000))
  if (days <= 14) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

function bucketStart(date: Date, granularity: Granularity): Date {
  const d = new Date(date)
  if (granularity === 'day') {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  if (granularity === 'week') {
    // ISO week start (Monday)
    const day = d.getDay() || 7
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1))
    return monday
  }
  // month
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function bucketKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function nextBucket(date: Date, granularity: Granularity): Date {
  if (granularity === 'day') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  }
  if (granularity === 'week') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
  }
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

/**
 * Compute a time series for a KPI by re-evaluating its formula bucketed by
 * granularity. Currently supported only for top-level AggOp formulas (not
 * composite). Returns empty if the formula doesn't have a timeframe_column.
 */
export function evaluateKPISeries(
  kpi: KPIDefinition,
  files: RawFileForEngine[],
  timeframe: Timeframe,
  granularity: Granularity
): SeriesPoint[] {
  const formula = kpi.formula
  // Only top-level aggregations get a series in v1
  if (!isAggOp(formula)) return []
  if (!formula.timeframe_column) return []
  if (!timeframe.start || !timeframe.end) return []

  const startDate = parseLooseDate(timeframe.start)
  const endDate = parseLooseDate(timeframe.end)
  if (!startDate || !endDate) return []

  const points: SeriesPoint[] = []
  const endTs = endDate.getTime()
  let cursor = bucketStart(startDate, granularity)
  while (cursor.getTime() <= endTs) {
    const bucketEnd = nextBucket(cursor, granularity)
    const sliceTf: Timeframe = {
      start: cursor.toISOString().slice(0, 10),
      end: new Date(bucketEnd.getTime() - 1).toISOString().slice(0, 10),
    }
    const ctx: EvalContext = {
      files,
      timeframe: sliceTf,
      rowsUsed: { value: 0 },
      sourcesUsed: new Set<string>(),
    }
    const value = evaluateFormula(formula, ctx)
    points.push({ bucket: bucketKey(cursor), value })
    cursor = bucketEnd
  }

  return points
}

export function evaluateKPI(
  kpi: KPIDefinition,
  files: RawFileForEngine[],
  timeframe: Timeframe
): KPIResult {
  const ctx: EvalContext = {
    files,
    timeframe,
    rowsUsed: { value: 0 },
    sourcesUsed: new Set<string>(),
  }
  let value: number | null = null
  let error: string | null = null
  try {
    value = evaluateFormula(kpi.formula, ctx)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  return {
    kpi_id: kpi.id,
    key: kpi.key,
    display_name: kpi.display_name,
    format: kpi.format,
    target: kpi.target,
    viz_type: kpi.viz_type,
    value,
    rows_used: ctx.rowsUsed.value,
    source_files: Array.from(ctx.sourcesUsed),
    error,
  }
}

export function formatKPIValue(value: number | null, format: 'count' | 'currency' | 'percent' | 'ratio'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'ratio':
      return value.toFixed(2)
    case 'count':
    default:
      return new Intl.NumberFormat('en-US').format(Math.round(value))
  }
}
