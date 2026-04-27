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
  Slicer,
} from './types'

interface EvalContext {
  files: RawFileForEngine[]
  timeframe: Timeframe
  /** Optional global slicers — applied to AggOps whose source has the column. */
  slicers?: Slicer[]
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
  // Bare YYYY-MM-DD → parse as LOCAL midnight (not UTC). This keeps timeframe
  // boundaries consistent with how the user sees dates in the picker, and
  // with how MM/DD/YYYY values get parsed (also local).
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const dt = new Date(
      parseInt(dateOnly[1], 10),
      parseInt(dateOnly[2], 10) - 1,
      parseInt(dateOnly[3], 10)
    )
    if (!Number.isNaN(dt.getTime())) return dt
  }
  // Anything else with timezone info / time component → use the JS parser
  const iso = new Date(s)
  if (!Number.isNaN(iso.getTime())) return iso
  // MM/DD/YYYY and DD-MM-YYYY style
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

function applySlicers(file: RawFileForEngine, slicers: Slicer[] | undefined, row: Record<string, unknown>): boolean {
  if (!slicers || slicers.length === 0) return true
  for (const s of slicers) {
    // Slicers only apply to KPIs whose source file matches the slicer's filename
    if (s.filename !== file.filename) continue
    // ...and only if the file actually has the column
    if (!file.columns.includes(s.column)) continue
    if (!s.values || s.values.length === 0) continue
    const cell = row[s.column]
    const cellStr = cell == null ? '' : String(cell).trim().toLowerCase()
    const allowed = new Set(s.values.map((v) => v.toLowerCase()))
    if (!allowed.has(cellStr)) return false
  }
  return true
}

function evaluateAgg(node: AggOp, ctx: EvalContext): number | null {
  const file = findSource(ctx.files, node.source)
  if (!file) return null
  ctx.sourcesUsed.add(file.filename)

  const matching = file.rows.filter(
    (row) =>
      rowMatchesFilters(row, node.filters) &&
      isInTimeframe(row, node.timeframe_column, ctx.timeframe) &&
      applySlicers(file, ctx.slicers, row)
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
 * Defaults: ≤14d → daily, ≤120d → weekly, > → monthly.
 * Thresholds are configurable via app_config REPORTING_GRANULARITY_THRESHOLDS_JSON.
 */
export function pickGranularity(
  tf: Timeframe,
  thresholds: { day_max: number; week_max: number } = { day_max: 14, week_max: 120 }
): Granularity {
  if (!tf.start || !tf.end) return 'week'
  const start = new Date(tf.start).getTime()
  const end = new Date(tf.end).getTime()
  const days = Math.max(1, (end - start) / (24 * 60 * 60 * 1000))
  if (days <= thresholds.day_max) return 'day'
  if (days <= thresholds.week_max) return 'week'
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
  // Local-time YYYY-MM-DD (matches how the picker emits dates and how
  // parseLooseDate now interprets them).
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
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
  granularity: Granularity,
  options?: { slicers?: Slicer[] }
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
      start: bucketKey(cursor),
      end: bucketKey(new Date(bucketEnd.getTime() - 1)),
    }
    const ctx: EvalContext = {
      files,
      timeframe: sliceTf,
      slicers: options?.slicers,
      rowsUsed: { value: 0 },
      sourcesUsed: new Set<string>(),
    }
    const value = evaluateFormula(formula, ctx)
    points.push({ bucket: bucketKey(cursor), value })
    cursor = bucketEnd
  }

  return points
}

/** Compute the prior-period timeframe for a given timeframe + mode. */
export function priorTimeframe(tf: Timeframe, mode: 'previous_period' | 'previous_year'): Timeframe {
  if (!tf.start || !tf.end) return { start: null, end: null }
  const startD = parseLooseDate(tf.start)
  const endD = parseLooseDate(tf.end)
  if (!startD || !endD) return { start: null, end: null }
  const startTs = startD.getTime()
  const endTs = endD.getTime()
  if (mode === 'previous_year') {
    const offset = 365 * 24 * 60 * 60 * 1000
    return {
      start: bucketKey(new Date(startTs - offset)),
      end: bucketKey(new Date(endTs - offset)),
    }
  }
  const span = endTs - startTs
  return {
    start: bucketKey(new Date(startTs - span - 24 * 60 * 60 * 1000)),
    end: bucketKey(new Date(startTs - 24 * 60 * 60 * 1000)),
  }
}

/** Group-by breakdown: re-evaluate the formula once per distinct group value. */
function evaluateGroupBy(
  kpi: KPIDefinition,
  files: RawFileForEngine[],
  timeframe: Timeframe,
  slicers: Slicer[] | undefined
): { group: string; value: number | null; rows_used: number }[] | null {
  if (!kpi.group_by_column) return null
  const file = files.find((f) => f.filename === (kpi.group_by_source ?? ''))
    || files.find((f) => f.columns.includes(kpi.group_by_column!))
  if (!file) return null
  const groupValues = new Set<string>()
  for (const row of file.rows) {
    const v = row[kpi.group_by_column!]
    if (v != null && String(v).trim() !== '') groupValues.add(String(v).trim())
  }
  if (groupValues.size === 0) return null

  const out: { group: string; value: number | null; rows_used: number }[] = []
  for (const g of groupValues) {
    // Wrap formula by injecting a filter on the group column at the AggOp level.
    // Simplest approach: only support group-by for top-level AggOp formulas.
    if (!isAggOp(kpi.formula)) continue
    const augmented: AggOp = {
      ...kpi.formula,
      filters: [
        ...(kpi.formula.filters ?? []),
        { column: kpi.group_by_column!, op: 'eq', value: g },
      ],
    }
    const ctx: EvalContext = {
      files,
      timeframe,
      slicers,
      rowsUsed: { value: 0 },
      sourcesUsed: new Set<string>(),
    }
    const value = evaluateFormula(augmented, ctx)
    out.push({ group: g, value, rows_used: ctx.rowsUsed.value })
  }

  // Sort + cap based on chart_options
  const opts = kpi.chart_options ?? {}
  const sortMode = opts.sort_groups ?? 'value_desc'
  if (sortMode === 'value_desc') {
    out.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  } else if (sortMode === 'value_asc') {
    out.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity))
  } else {
    out.sort((a, b) => a.group.localeCompare(b.group))
  }
  const cap = Math.max(1, Math.min(50, opts.max_groups ?? 8))
  return out.slice(0, cap)
}

/** Linear-regression / moving-average forecast on a series. */
export function forecastSeries(
  series: { bucket: string; value: number | null }[],
  periods: number,
  method: 'linear' | 'moving_avg' = 'linear'
): { bucket: string; value: number | null }[] {
  const cleaned = series.filter((p) => p.value != null) as { bucket: string; value: number }[]
  if (cleaned.length < 2 || periods <= 0) return []

  const last = cleaned[cleaned.length - 1]
  const lastDate = new Date(last.bucket).getTime()
  // Infer step from average gap of the last few points
  const gaps: number[] = []
  for (let i = 1; i < cleaned.length; i++) {
    gaps.push(new Date(cleaned[i].bucket).getTime() - new Date(cleaned[i - 1].bucket).getTime())
  }
  const stepMs = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 7 * 24 * 60 * 60 * 1000

  let predict: (i: number) => number
  if (method === 'moving_avg') {
    const window = Math.min(4, cleaned.length)
    const tail = cleaned.slice(-window)
    const avg = tail.reduce((a, p) => a + p.value, 0) / tail.length
    predict = () => avg
  } else {
    // Linear regression: y = mx + b on indices
    const n = cleaned.length
    const xs = cleaned.map((_, i) => i)
    const ys = cleaned.map((p) => p.value)
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0)
    const denom = n * sumXX - sumX * sumX
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    predict = (i: number) => slope * (n - 1 + i) + intercept
  }

  const out: { bucket: string; value: number | null }[] = []
  for (let i = 1; i <= periods; i++) {
    const date = new Date(lastDate + stepMs * i)
    out.push({ bucket: bucketKey(date), value: predict(i) })
  }
  return out
}

export function evaluateKPI(
  kpi: KPIDefinition,
  files: RawFileForEngine[],
  timeframe: Timeframe,
  options?: { slicers?: Slicer[] }
): KPIResult {
  const slicers = options?.slicers
  const ctx: EvalContext = {
    files,
    timeframe,
    slicers,
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

  // Period-over-period
  let compare: KPIResult['compare'] = null
  if (kpi.compare_to) {
    const priorTf = priorTimeframe(timeframe, kpi.compare_to)
    const priorCtx: EvalContext = {
      files,
      timeframe: priorTf,
      slicers,
      rowsUsed: { value: 0 },
      sourcesUsed: new Set<string>(),
    }
    let previous_value: number | null = null
    try {
      previous_value = evaluateFormula(kpi.formula, priorCtx)
    } catch {
      previous_value = null
    }
    if (previous_value != null && value != null) {
      const delta_absolute = value - previous_value
      const delta_percent = previous_value !== 0 ? delta_absolute / Math.abs(previous_value) : null
      compare = { previous_value, delta_absolute, delta_percent }
    } else {
      compare = { previous_value, delta_absolute: null, delta_percent: null }
    }
  }

  // Group-by
  const groups = evaluateGroupBy(kpi, files, timeframe, slicers) ?? undefined

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
    compare,
    groups,
    chart_options: kpi.chart_options,
  }
}

export interface FormatOptions {
  /** ISO 4217 currency code (e.g. 'USD', 'EUR', 'GBP'). Default 'USD'. */
  currency?: string
  /** BCP-47 locale (e.g. 'en-US', 'en-GB', 'fr-FR'). Default 'en-US'. */
  locale?: string
}

export function formatKPIValue(
  value: number | null,
  format: 'count' | 'currency' | 'percent' | 'ratio',
  opts: FormatOptions = {}
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const locale = opts.locale ?? 'en-US'
  const currency = opts.currency ?? 'USD'
  switch (format) {
    case 'currency':
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(value)
      } catch {
        // Fall back to USD if invalid currency/locale combo
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
      }
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'ratio':
      return value.toFixed(2)
    case 'count':
    default:
      try {
        return new Intl.NumberFormat(locale).format(Math.round(value))
      } catch {
        return new Intl.NumberFormat('en-US').format(Math.round(value))
      }
  }
}
