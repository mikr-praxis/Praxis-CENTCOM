/**
 * Unit tests for the KPI formula evaluator.
 *
 * Tests via the public entry points (evaluateKPI, evaluateKPISeries,
 * pickGranularity, priorTimeframe, forecastSeries, formatKPIValue) so
 * internal refactors don't break the suite.
 *
 * Coverage targets are enforced in jest.config.ts.
 */
import {
  evaluateKPI,
  evaluateKPISeries,
  pickGranularity,
  priorTimeframe,
  forecastSeries,
  formatKPIValue,
} from '../engine'
import type {
  AggOp,
  CompositeOp,
  Filter,
  Formula,
  KPIDefinition,
  RawFileForEngine,
  Timeframe,
} from '../types'
import type { ExternalFactRow } from '../external-facts'
import { factCacheKey } from '../external-facts'

/* ──────────────────────── fixtures ──────────────────────── */

function fileSales(): RawFileForEngine {
  // Two-week window, mixed currencies stripped at parse-time.
  return {
    filename: 'sales.csv',
    columns: ['date', 'revenue', 'closes', 'stage', 'rep'],
    rows: [
      { date: '2026-05-01', revenue: 100, closes: 1, stage: 'won', rep: 'alex' },
      { date: '2026-05-02', revenue: 200, closes: 2, stage: 'won', rep: 'alex' },
      { date: '2026-05-03', revenue: '$50', closes: 1, stage: 'won', rep: 'jamie' },
      { date: '2026-05-04', revenue: 0, closes: 0, stage: 'lost', rep: 'jamie' },
      { date: '2026-05-05', revenue: 300, closes: 3, stage: 'won', rep: 'alex' },
      { date: '2026-05-06', revenue: null, closes: 0, stage: 'lost', rep: 'alex' },
    ],
  }
}

function fileAds(): RawFileForEngine {
  return {
    filename: 'meta-ads.csv',
    columns: ['day', 'spend', 'impressions'],
    rows: [
      { day: '2026-05-01', spend: 10, impressions: 1000 },
      { day: '2026-05-02', spend: 20, impressions: 2000 },
      { day: '2026-05-03', spend: 30, impressions: 3000 },
      { day: '2026-05-04', spend: 40, impressions: 4000 },
      { day: '2026-05-05', spend: 50, impressions: 5000 },
    ],
  }
}

function kpi(formula: Formula, overrides: Partial<KPIDefinition> = {}): KPIDefinition {
  return {
    id: 'test-kpi',
    client_id: 'client-1',
    key: 'test',
    display_name: 'Test KPI',
    description: null,
    formula,
    format: 'count',
    target: null,
    viz_type: 'card',
    display_order: 0,
    group_by_column: null,
    group_by_source: null,
    compare_to: null,
    forecast_periods: 0,
    forecast_method: null,
    chart_options: {},
    ...overrides,
  }
}

const NO_TF: Timeframe = { start: null, end: null }

/* ──────────────────────── evaluateKPI: AggOps ──────────────────────── */

describe('evaluateKPI — aggregation ops', () => {
  const files = [fileSales()]

  test('count returns row count without a column', () => {
    const f: AggOp = { op: 'count', source: 'sales.csv' }
    const r = evaluateKPI(kpi(f), files, NO_TF)
    expect(r.value).toBe(6)
    expect(r.rows_used).toBe(6)
    expect(r.source_files).toContain('sales.csv')
  })

  test('sum coerces "$50" and skips null', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue' }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(100 + 200 + 50 + 0 + 300) // 650
  })

  test('sum on empty match returns 0 (not null)', () => {
    const f: AggOp = {
      op: 'sum',
      source: 'sales.csv',
      column: 'revenue',
      filters: [{ column: 'stage', op: 'eq', value: 'nope' }],
    }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(0)
  })

  test('avg ignores null values', () => {
    const f: AggOp = { op: 'avg', source: 'sales.csv', column: 'closes' }
    // closes: 1, 2, 1, 0, 3, 0 → avg = 7/6
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBeCloseTo(7 / 6, 5)
  })

  test('min / max', () => {
    const min: AggOp = { op: 'min', source: 'sales.csv', column: 'closes' }
    const max: AggOp = { op: 'max', source: 'sales.csv', column: 'closes' }
    expect(evaluateKPI(kpi(min), files, NO_TF).value).toBe(0)
    expect(evaluateKPI(kpi(max), files, NO_TF).value).toBe(3)
  })

  test('count_distinct on rep', () => {
    const f: AggOp = { op: 'count_distinct', source: 'sales.csv', column: 'rep' }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(2) // alex, jamie
  })

  test('returns null when source filename does not exist', () => {
    const f: AggOp = { op: 'sum', source: 'missing.csv', column: 'revenue' }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBeNull()
  })

  test('findSource falls back to case-insensitive match', () => {
    const f: AggOp = { op: 'count', source: 'SALES.CSV' }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(6)
  })
})

/* ──────────────────────── filters ──────────────────────── */

describe('evaluateKPI — filters', () => {
  const files = [fileSales()]

  function withFilter(filters: Filter[]): AggOp {
    return { op: 'count', source: 'sales.csv', filters }
  }

  test('eq', () => {
    expect(evaluateKPI(kpi(withFilter([{ column: 'stage', op: 'eq', value: 'won' }])), files, NO_TF).value).toBe(4)
  })
  test('neq', () => {
    expect(evaluateKPI(kpi(withFilter([{ column: 'stage', op: 'neq', value: 'won' }])), files, NO_TF).value).toBe(2)
  })
  test('in / not_in', () => {
    expect(evaluateKPI(kpi(withFilter([{ column: 'rep', op: 'in', value: ['alex', 'jamie'] }])), files, NO_TF).value).toBe(6)
    expect(evaluateKPI(kpi(withFilter([{ column: 'rep', op: 'not_in', value: ['alex'] }])), files, NO_TF).value).toBe(2)
  })
  test('contains is case-insensitive', () => {
    expect(evaluateKPI(kpi(withFilter([{ column: 'rep', op: 'contains', value: 'ALEX' }])), files, NO_TF).value).toBe(4)
  })
  test('gt / gte / lt / lte on numeric column', () => {
    expect(evaluateKPI(kpi(withFilter([{ column: 'closes', op: 'gt', value: 1 }])), files, NO_TF).value).toBe(2)
    expect(evaluateKPI(kpi(withFilter([{ column: 'closes', op: 'gte', value: 1 }])), files, NO_TF).value).toBe(4)
    expect(evaluateKPI(kpi(withFilter([{ column: 'closes', op: 'lt', value: 1 }])), files, NO_TF).value).toBe(2)
    expect(evaluateKPI(kpi(withFilter([{ column: 'closes', op: 'lte', value: 1 }])), files, NO_TF).value).toBe(4)
  })
  test('empty / not_empty', () => {
    expect(evaluateKPI(kpi(withFilter([{ column: 'revenue', op: 'empty' }])), files, NO_TF).value).toBe(1)
    expect(evaluateKPI(kpi(withFilter([{ column: 'revenue', op: 'not_empty' }])), files, NO_TF).value).toBe(5)
  })
  test('multiple filters AND together', () => {
    const f = withFilter([
      { column: 'stage', op: 'eq', value: 'won' },
      { column: 'rep', op: 'eq', value: 'alex' },
    ])
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(3) // 2026-05-01,02,05
  })
})

/* ──────────────────────── timeframe ──────────────────────── */

describe('evaluateKPI — timeframe filtering', () => {
  const files = [fileSales()]

  test('inclusive on both ends with date-only strings', () => {
    const f: AggOp = {
      op: 'count',
      source: 'sales.csv',
      timeframe_column: 'date',
    }
    const tf: Timeframe = { start: '2026-05-02', end: '2026-05-04' }
    expect(evaluateKPI(kpi(f), files, tf).value).toBe(3) // 02, 03, 04
  })

  test('rows outside timeframe are excluded', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue', timeframe_column: 'date' }
    const tf: Timeframe = { start: '2026-05-01', end: '2026-05-02' }
    expect(evaluateKPI(kpi(f), files, tf).value).toBe(300)
  })

  test('null start/end disables that boundary', () => {
    const f: AggOp = { op: 'count', source: 'sales.csv', timeframe_column: 'date' }
    expect(evaluateKPI(kpi(f), files, { start: '2026-05-04', end: null }).value).toBe(3)
    expect(evaluateKPI(kpi(f), files, { start: null, end: '2026-05-02' }).value).toBe(2)
  })

  test('formula without timeframe_column ignores timeframe entirely', () => {
    const f: AggOp = { op: 'count', source: 'sales.csv' }
    expect(evaluateKPI(kpi(f), files, { start: '2026-05-01', end: '2026-05-01' }).value).toBe(6)
  })
})

/* ──────────────────────── slicers ──────────────────────── */

describe('evaluateKPI — slicers', () => {
  const files = [fileSales()]

  test('slicer scoped to matching filename + column applies', () => {
    const f: AggOp = { op: 'count', source: 'sales.csv' }
    const r = evaluateKPI(kpi(f), files, NO_TF, {
      slicers: [{ filename: 'sales.csv', column: 'rep', values: ['alex'] }],
    })
    expect(r.value).toBe(4)
  })

  test('slicer for a different filename is a no-op', () => {
    const f: AggOp = { op: 'count', source: 'sales.csv' }
    const r = evaluateKPI(kpi(f), files, NO_TF, {
      slicers: [{ filename: 'other.csv', column: 'rep', values: ['alex'] }],
    })
    expect(r.value).toBe(6)
  })

  test('empty values array disables the slicer', () => {
    const f: AggOp = { op: 'count', source: 'sales.csv' }
    const r = evaluateKPI(kpi(f), files, NO_TF, {
      slicers: [{ filename: 'sales.csv', column: 'rep', values: [] }],
    })
    expect(r.value).toBe(6)
  })
})

/* ──────────────────────── composite ops ──────────────────────── */

describe('evaluateKPI — composite ops', () => {
  const files = [fileAds(), fileSales()]

  test('divide returns ratio', () => {
    const cpm: CompositeOp = {
      op: 'multiply',
      left: {
        op: 'divide',
        numerator: { op: 'sum', source: 'meta-ads.csv', column: 'spend' },
        denominator: { op: 'sum', source: 'meta-ads.csv', column: 'impressions' },
      },
      right: { op: 'const', value: 1000 },
    }
    // (150 / 15000) * 1000 = 10
    expect(evaluateKPI(kpi(cpm), files, NO_TF).value).toBe(10)
  })

  test('divide by zero returns null (not Infinity / NaN)', () => {
    const f: CompositeOp = {
      op: 'divide',
      numerator: { op: 'sum', source: 'sales.csv', column: 'revenue' },
      denominator: { op: 'const', value: 0 },
    }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBeNull()
  })

  test('add / subtract', () => {
    const add: CompositeOp = {
      op: 'add',
      left: { op: 'const', value: 5 },
      right: { op: 'const', value: 3 },
    }
    const sub: CompositeOp = {
      op: 'subtract',
      left: { op: 'const', value: 5 },
      right: { op: 'const', value: 3 },
    }
    expect(evaluateKPI(kpi(add), files, NO_TF).value).toBe(8)
    expect(evaluateKPI(kpi(sub), files, NO_TF).value).toBe(2)
  })

  test('composite with missing source returns null', () => {
    const f: CompositeOp = {
      op: 'divide',
      numerator: { op: 'sum', source: 'missing.csv', column: 'x' },
      denominator: { op: 'const', value: 1 },
    }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBeNull()
  })
})

/* ──────────────────────── all_files mode ──────────────────────── */

describe('evaluateKPI — all_files aggregation', () => {
  test('sums column across every file that has it', () => {
    const files = [fileSales(), fileAds()]
    const f: AggOp = { op: 'sum', source: '*', column: 'revenue', all_files: true }
    // Only sales.csv has `revenue`; ads file is ignored.
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(650)
  })

  test('count without column counts rows across every file', () => {
    const files = [fileSales(), fileAds()]
    const f: AggOp = { op: 'count', source: '*', all_files: true }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(11) // 6 + 5
  })

  test('returns null when no file contains the column', () => {
    const files = [fileSales()]
    const f: AggOp = { op: 'sum', source: '*', column: 'nonexistent', all_files: true }
    expect(evaluateKPI(kpi(f), files, NO_TF).value).toBe(0) // sum of empty = 0 by convention
  })
})

/* ──────────────────────── external facts (source_type) ──────────────────────── */

describe('evaluateKPI — source_type-backed AggOps (PostHog / Stripe / etc.)', () => {
  function buildFacts(rows: ExternalFactRow[]): Map<string, ExternalFactRow[]> {
    const m = new Map<string, ExternalFactRow[]>()
    m.set(factCacheKey('posthog', 'opt_ins'), rows)
    return m
  }

  test('sums value column across all preloaded facts', () => {
    const facts = buildFacts([
      { ts: '2026-05-01T00:00:00Z', value: 5, dimensions: {} },
      { ts: '2026-05-02T00:00:00Z', value: 7, dimensions: {} },
      { ts: '2026-05-03T00:00:00Z', value: 11, dimensions: {} },
    ])
    const f: AggOp = {
      op: 'sum',
      source: '',
      source_type: 'posthog',
      kind: 'opt_ins',
      column: 'value',
      timeframe_column: 'ts',
    }
    expect(evaluateKPI(kpi(f), [], NO_TF, { externalFacts: facts }).value).toBe(23)
  })

  test('respects timeframe on ts column', () => {
    const facts = buildFacts([
      { ts: '2026-05-01T00:00:00Z', value: 5, dimensions: {} },
      { ts: '2026-05-02T00:00:00Z', value: 7, dimensions: {} },
      { ts: '2026-05-03T00:00:00Z', value: 11, dimensions: {} },
    ])
    const f: AggOp = {
      op: 'sum',
      source: '',
      source_type: 'posthog',
      kind: 'opt_ins',
      column: 'value',
      timeframe_column: 'ts',
    }
    const r = evaluateKPI(kpi(f), [], { start: '2026-05-02', end: '2026-05-02' }, { externalFacts: facts })
    expect(r.value).toBe(7)
  })

  test('returns null when cache is empty for the requested (source_type, kind)', () => {
    const f: AggOp = { op: 'sum', source: '', source_type: 'posthog', kind: 'opt_ins', column: 'value' }
    expect(evaluateKPI(kpi(f), [], NO_TF, { externalFacts: new Map() }).value).toBeNull()
  })

  test('returns null when no externalFacts option is provided', () => {
    const f: AggOp = { op: 'sum', source: '', source_type: 'posthog', kind: 'opt_ins', column: 'value' }
    expect(evaluateKPI(kpi(f), [], NO_TF).value).toBeNull()
  })

  test('count works without a column', () => {
    const facts = buildFacts([
      { ts: '2026-05-01T00:00:00Z', value: 5, dimensions: {} },
      { ts: '2026-05-02T00:00:00Z', value: 7, dimensions: {} },
    ])
    const f: AggOp = { op: 'count', source: '', source_type: 'posthog', kind: 'opt_ins' }
    expect(evaluateKPI(kpi(f), [], NO_TF, { externalFacts: facts }).value).toBe(2)
  })

  test('dimensions become filterable columns', () => {
    const facts = buildFacts([
      { ts: '2026-05-01T00:00:00Z', value: 5, dimensions: { campaign: 'a' } },
      { ts: '2026-05-02T00:00:00Z', value: 7, dimensions: { campaign: 'b' } },
      { ts: '2026-05-03T00:00:00Z', value: 11, dimensions: { campaign: 'a' } },
    ])
    const f: AggOp = {
      op: 'sum',
      source: '',
      source_type: 'posthog',
      kind: 'opt_ins',
      column: 'value',
      filters: [{ column: 'campaign', op: 'eq', value: 'a' }],
    }
    expect(evaluateKPI(kpi(f), [], NO_TF, { externalFacts: facts }).value).toBe(16)
  })
})

/* ──────────────────────── group_by ──────────────────────── */

describe('evaluateKPI — group_by', () => {
  const files = [fileSales()]

  test('breaks the metric down by distinct values, sorted by value desc', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue' }
    const r = evaluateKPI(
      kpi(f, { group_by_column: 'rep', group_by_source: 'sales.csv' }),
      files,
      NO_TF
    )
    expect(r.groups).toBeDefined()
    expect(r.groups?.length).toBe(2)
    // alex: 100+200+300+0 (null skipped) = 600; jamie: 50+0 = 50
    const alex = r.groups?.find((g) => g.group === 'alex')
    const jamie = r.groups?.find((g) => g.group === 'jamie')
    expect(alex?.value).toBe(600)
    expect(jamie?.value).toBe(50)
    expect((r.groups ?? [])[0].group).toBe('alex') // value_desc default
  })

  test('group_asc sorts alphabetically', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue' }
    const r = evaluateKPI(
      kpi(f, {
        group_by_column: 'rep',
        group_by_source: 'sales.csv',
        chart_options: { sort_groups: 'group_asc' },
      }),
      files,
      NO_TF
    )
    expect((r.groups ?? [])[0].group).toBe('alex')
    expect((r.groups ?? [])[1].group).toBe('jamie')
  })
})

/* ──────────────────────── compare_to ──────────────────────── */

describe('evaluateKPI — period-over-period compare', () => {
  const files = [fileSales()]

  test('previous_period produces a prior-window value + delta', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue', timeframe_column: 'date' }
    const r = evaluateKPI(
      kpi(f, { compare_to: 'previous_period' }),
      files,
      { start: '2026-05-04', end: '2026-05-06' } // value: 0+300+0 = 300; prior: 100+200+50 = 350
    )
    expect(r.compare?.previous_value).toBe(350)
    expect(r.compare?.delta_absolute).toBe(-50)
    expect(r.compare?.delta_percent).toBeCloseTo(-50 / 350, 5)
  })

  test('current dropping to 0 produces delta_percent of -1', () => {
    const f: AggOp = {
      op: 'sum',
      source: 'sales.csv',
      column: 'revenue',
      timeframe_column: 'date',
      filters: [{ column: 'stage', op: 'eq', value: 'won' }],
    }
    const r = evaluateKPI(
      kpi(f, { compare_to: 'previous_period' }),
      files,
      { start: '2026-05-04', end: '2026-05-04' } // current: 0 (lost), prior 05-03: 50 (jamie won)
    )
    expect(r.compare?.previous_value).toBe(50)
    expect(r.compare?.delta_percent).toBeCloseTo(-1, 5)
  })

  test('delta_percent is null when prior period has zero value', () => {
    const f: AggOp = {
      op: 'sum',
      source: 'sales.csv',
      column: 'revenue',
      timeframe_column: 'date',
      filters: [{ column: 'stage', op: 'eq', value: 'lost' }], // only 04 and 06 are lost
    }
    const r = evaluateKPI(
      kpi(f, { compare_to: 'previous_period' }),
      files,
      { start: '2026-05-04', end: '2026-05-04' } // current: 0; prior 05-03: jamie won (excluded by filter) → 0
    )
    expect(r.compare?.previous_value).toBe(0)
    expect(r.compare?.delta_percent).toBeNull()
  })
})

/* ──────────────────────── series ──────────────────────── */

describe('evaluateKPISeries', () => {
  const files = [fileSales()]

  test('daily series buckets one row per day', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue', timeframe_column: 'date' }
    const points = evaluateKPISeries(
      kpi(f),
      files,
      { start: '2026-05-01', end: '2026-05-03' },
      'day'
    )
    expect(points).toHaveLength(3)
    expect(points[0]).toEqual({ bucket: '2026-05-01', value: 100 })
    expect(points[1]).toEqual({ bucket: '2026-05-02', value: 200 })
    expect(points[2]).toEqual({ bucket: '2026-05-03', value: 50 })
  })

  test('returns empty when formula has no timeframe_column', () => {
    const f: AggOp = { op: 'sum', source: 'sales.csv', column: 'revenue' }
    expect(evaluateKPISeries(kpi(f), files, { start: '2026-05-01', end: '2026-05-03' }, 'day')).toEqual([])
  })

  test('returns empty for composite formulas', () => {
    const f: CompositeOp = {
      op: 'divide',
      numerator: { op: 'sum', source: 'sales.csv', column: 'revenue' },
      denominator: { op: 'const', value: 2 },
    }
    expect(evaluateKPISeries(kpi(f), files, { start: '2026-05-01', end: '2026-05-03' }, 'day')).toEqual([])
  })
})

/* ──────────────────────── pure helpers ──────────────────────── */

describe('pickGranularity', () => {
  test('default thresholds: ≤14d → day, ≤120d → week, > → month', () => {
    expect(pickGranularity({ start: '2026-05-01', end: '2026-05-08' })).toBe('day')
    expect(pickGranularity({ start: '2026-01-01', end: '2026-03-01' })).toBe('week')
    expect(pickGranularity({ start: '2025-01-01', end: '2026-05-01' })).toBe('month')
  })
  test('open-ended timeframe defaults to week', () => {
    expect(pickGranularity({ start: null, end: null })).toBe('week')
  })
  test('custom thresholds', () => {
    expect(pickGranularity({ start: '2026-05-01', end: '2026-05-08' }, { day_max: 3, week_max: 30 })).toBe('week')
  })
})

describe('priorTimeframe', () => {
  test('previous_period mirrors the current window', () => {
    const r = priorTimeframe({ start: '2026-05-04', end: '2026-05-06' }, 'previous_period')
    expect(r.start).toBe('2026-05-01')
    expect(r.end).toBe('2026-05-03')
  })
  test('previous_year shifts back ~365 days', () => {
    const r = priorTimeframe({ start: '2026-05-01', end: '2026-05-07' }, 'previous_year')
    expect(r.start).toBe('2025-05-01')
    expect(r.end).toBe('2025-05-07')
  })
  test('null timeframe returns null timeframe', () => {
    expect(priorTimeframe({ start: null, end: null }, 'previous_period')).toEqual({ start: null, end: null })
  })
})

describe('forecastSeries', () => {
  test('linear continues an upward trend', () => {
    const series = [
      { bucket: '2026-05-01', value: 100 },
      { bucket: '2026-05-02', value: 200 },
      { bucket: '2026-05-03', value: 300 },
    ]
    const fc = forecastSeries(series, 2, 'linear')
    expect(fc).toHaveLength(2)
    expect(fc[0].value).toBeCloseTo(400, 0)
    expect(fc[1].value).toBeCloseTo(500, 0)
  })
  test('returns empty when periods is 0', () => {
    const series = [{ bucket: '2026-05-01', value: 100 }]
    expect(forecastSeries(series, 0, 'linear')).toEqual([])
  })
  test('moving_avg uses a rolling window of the last N points', () => {
    const series = [
      { bucket: '2026-05-01', value: 10 },
      { bucket: '2026-05-02', value: 20 },
      { bucket: '2026-05-03', value: 30 },
    ]
    const fc = forecastSeries(series, 2, 'moving_avg')
    expect(fc).toHaveLength(2)
    // First forecast point: avg of last 3 historical = 20.
    expect(fc[0].value).toBe(20)
  })
})

describe('formatKPIValue', () => {
  test('count format rounds + groups', () => {
    expect(formatKPIValue(1234, 'count')).toBe('1,234')
    expect(formatKPIValue(1234.7, 'count')).toBe('1,235')
  })
  test('currency format with default USD (no fraction digits)', () => {
    expect(formatKPIValue(1234.5, 'currency')).toBe('$1,235')
  })
  test('percent format multiplies and adds %', () => {
    expect(formatKPIValue(0.125, 'percent')).toBe('12.5%')
  })
  test('ratio format keeps 2 decimals', () => {
    expect(formatKPIValue(2.5, 'ratio')).toBe('2.50')
  })
  test('null and non-finite → em-dash regardless of format', () => {
    expect(formatKPIValue(null, 'count')).toBe('—')
    expect(formatKPIValue(null, 'currency')).toBe('—')
    expect(formatKPIValue(Number.NaN, 'count')).toBe('—')
    expect(formatKPIValue(Number.POSITIVE_INFINITY, 'currency')).toBe('—')
  })
})
