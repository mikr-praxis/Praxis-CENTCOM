/**
 * Free, offline heuristic KPI suggester. Reads file columns + inferred types
 * + top distinct values, and emits a sensible starter dashboard without any
 * AI calls. Same output shape as ai-recommend so the UI can treat them identically.
 */

import type { Formula, AggOp } from './types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'
import type { AISuggestion } from './ai-suggest'

export interface ColumnHint {
  name: string
  type: 'number' | 'date' | 'boolean' | 'text'
  distinct_count: number
  empty_count: number
  top_values: { value: string; count: number }[]
}

export interface FileHints {
  filename: string
  row_count: number
  columns: ColumnHint[]
}

type ColumnRole = 'money' | 'count_metric' | 'status' | 'date' | 'id' | 'boolean' | 'number' | 'text'

const MONEY_PATTERNS = [
  /revenue/i,
  /amount/i,
  /(?:^|[^a-z])value(?:[^a-z]|$)/i,
  /\b(cost|spend|fee|price|total|cash|gross|net|gmv|mrr|arr|aov)\b/i,
  /payment/i,
  /\$/,
]
const COUNT_METRIC_PATTERNS = [
  /\b(count|qty|quantity|units?|impressions?|clicks|opens|views|reach|sessions|signups?|registrations?)\b/i,
]
const STATUS_PATTERNS = [/\b(status|stage|state|phase|outcome|disposition|result|verdict|tier)\b/i]
const DATE_PATTERNS = [
  /\b(date|time|created|modified|updated|when|ts|timestamp)\b/i,
  /_at$/i,
  /_on$/i,
  /_date$/i,
  /_time$/i,
]
const ID_PATTERNS = [/_id$/i, /^id$/i, /email/i, /uuid/i]

const WINNING_TOKENS = [
  'won',
  'closed won',
  'closed-won',
  'closedwon',
  'closed_won',
  'paid',
  'success',
  'successful',
  'completed',
  'complete',
  'active',
  'subscribed',
  'enrolled',
  'attended',
  'qualified',
]

function looksLikeWinningValue(v: string): boolean {
  const lower = v.toLowerCase().trim()
  return WINNING_TOKENS.some((t) => lower === t || lower.includes(t))
}

function classifyColumn(col: ColumnHint): ColumnRole {
  const n = col.name.toLowerCase()
  if (col.type === 'date' || DATE_PATTERNS.some((p) => p.test(n))) return 'date'
  if (col.type === 'boolean') return 'boolean'
  if (col.type === 'number') {
    if (MONEY_PATTERNS.some((p) => p.test(n))) return 'money'
    if (COUNT_METRIC_PATTERNS.some((p) => p.test(n))) return 'count_metric'
    return 'number'
  }
  if (STATUS_PATTERNS.some((p) => p.test(n)) && col.distinct_count >= 2 && col.distinct_count <= 30) return 'status'
  if (ID_PATTERNS.some((p) => p.test(n))) return 'id'
  return 'text'
}

function prettify(col: string): string {
  return col
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function pickPrimaryDate(cols: ColumnHint[]): string | null {
  const dates = cols.filter((c) => classifyColumn(c) === 'date')
  if (dates.length === 0) return null
  // Prefer "created" / "_at" patterns over generic "date"
  const ranked = [...dates].sort((a, b) => {
    const an = a.name.toLowerCase()
    const bn = b.name.toLowerCase()
    const score = (n: string) =>
      /created/i.test(n) ? 3 : /_at$/i.test(n) ? 2 : /date$/i.test(n) ? 1 : 0
    return score(bn) - score(an)
  })
  return ranked[0].name
}

interface Builder {
  formula: Formula
  display_name: string
  description: string
  format: KPIFormat
  viz_type: KPIVizType
  weight: number // higher = preferred when culling
}

function suggestionsForFile(file: FileHints, primaryDate: string | null): Builder[] {
  const out: Builder[] = []
  const filePretty = file.filename.replace(/\.[^.]+$/, '')
  const filePrettyTitle = prettify(filePretty)

  // 1. Total rows
  out.push({
    formula: {
      op: 'count',
      source: file.filename,
      filters: [],
      ...(primaryDate ? { timeframe_column: primaryDate } : {}),
    } as AggOp,
    display_name: `Total ${filePrettyTitle}`,
    description: `Total rows in ${file.filename}.`,
    format: 'count',
    viz_type: 'card',
    weight: 50,
  })

  // 2. Money columns: SUM, AVG
  for (const col of file.columns.filter((c) => classifyColumn(c) === 'money')) {
    const colPretty = prettify(col.name)
    out.push({
      formula: {
        op: 'sum',
        source: file.filename,
        column: col.name,
        filters: [],
        ...(primaryDate ? { timeframe_column: primaryDate } : {}),
      } as AggOp,
      display_name: `Total ${colPretty}`,
      description: `Sum of ${col.name} from ${file.filename}.`,
      format: 'currency',
      viz_type: 'card',
      weight: 100,
    })
    out.push({
      formula: {
        op: 'avg',
        source: file.filename,
        column: col.name,
        filters: [],
        ...(primaryDate ? { timeframe_column: primaryDate } : {}),
      } as AggOp,
      display_name: `Average ${colPretty}`,
      description: `Average ${col.name} per row in ${file.filename}.`,
      format: 'currency',
      viz_type: 'card',
      weight: 70,
    })
    // Trend chart
    if (primaryDate) {
      out.push({
        formula: {
          op: 'sum',
          source: file.filename,
          column: col.name,
          filters: [],
          timeframe_column: primaryDate,
        } as AggOp,
        display_name: `${colPretty} Trend`,
        description: `${colPretty} over time, bucketed by the selected timeframe.`,
        format: 'currency',
        viz_type: 'line',
        weight: 80,
      })
    }
  }

  // 3. Count-metric numeric columns (impressions, clicks, etc.)
  for (const col of file.columns.filter((c) => classifyColumn(c) === 'count_metric')) {
    const colPretty = prettify(col.name)
    out.push({
      formula: {
        op: 'sum',
        source: file.filename,
        column: col.name,
        filters: [],
        ...(primaryDate ? { timeframe_column: primaryDate } : {}),
      } as AggOp,
      display_name: `Total ${colPretty}`,
      description: `Sum of ${col.name} from ${file.filename}.`,
      format: 'count',
      viz_type: 'card',
      weight: 60,
    })
  }

  // 4. Status columns: count where status = winning value
  for (const col of file.columns.filter((c) => classifyColumn(c) === 'status')) {
    const winning = col.top_values.find((v) => looksLikeWinningValue(v.value))
    if (winning) {
      out.push({
        formula: {
          op: 'count',
          source: file.filename,
          filters: [{ column: col.name, op: 'eq', value: winning.value }],
          ...(primaryDate ? { timeframe_column: primaryDate } : {}),
        } as AggOp,
        display_name: `${prettify(filePretty)} — ${prettify(winning.value)}`,
        description: `Count of ${file.filename} where ${col.name} = "${winning.value}".`,
        format: 'count',
        viz_type: 'card',
        weight: 75,
      })

      // Composite: "win rate" (winning / all)
      out.push({
        formula: {
          op: 'divide',
          numerator: {
            op: 'count',
            source: file.filename,
            filters: [{ column: col.name, op: 'eq', value: winning.value }],
            ...(primaryDate ? { timeframe_column: primaryDate } : {}),
          } as AggOp,
          denominator: {
            op: 'count',
            source: file.filename,
            filters: [],
            ...(primaryDate ? { timeframe_column: primaryDate } : {}),
          } as AggOp,
        },
        display_name: `${prettify(filePretty)} ${prettify(winning.value)} Rate`,
        description: `Share of ${file.filename} rows where ${col.name} = "${winning.value}".`,
        format: 'percent',
        viz_type: 'card',
        weight: 90,
      })
    }
  }

  // 5. Distinct-count of ID-ish columns (only if distinct < total — i.e. dedup is meaningful)
  for (const col of file.columns.filter((c) => classifyColumn(c) === 'id')) {
    if (col.distinct_count > 0 && col.distinct_count < file.row_count) {
      out.push({
        formula: {
          op: 'count_distinct',
          source: file.filename,
          column: col.name,
          filters: [],
          ...(primaryDate ? { timeframe_column: primaryDate } : {}),
        } as AggOp,
        display_name: `Unique ${prettify(col.name)}`,
        description: `Distinct count of ${col.name} in ${file.filename}.`,
        format: 'count',
        viz_type: 'card',
        weight: 55,
      })
    }
  }

  return out
}

/**
 * Pick a varied subset of suggestions: at most one of each (filename, op, format, viz_type, primary column)
 * combination, then top up by weight to the target count.
 */
function pickVariety(builders: Builder[], count: number): Builder[] {
  const sorted = [...builders].sort((a, b) => b.weight - a.weight)
  const picked: Builder[] = []
  const seenSig = new Set<string>()

  function sig(b: Builder): string {
    const f = b.formula as AggOp
    return `${f.source ?? '?'}|${(f as AggOp).op}|${(f as AggOp).column ?? ''}|${b.format}|${b.viz_type}|${(f as AggOp).filters?.map((flt) => `${flt.column}=${flt.value}`).join(',') ?? ''}`
  }

  // First pass: enforce variety by signature
  for (const b of sorted) {
    if (picked.length >= count) break
    const s = sig(b)
    if (seenSig.has(s)) continue
    seenSig.add(s)
    picked.push(b)
  }
  // Top up if still short (we won't dup signatures; ok)
  return picked.slice(0, count)
}

export function heuristicSuggest(args: { files: FileHints[]; count?: number }): AISuggestion[] {
  const count = Math.min(Math.max(args.count ?? 6, 3), 10)

  const all: Builder[] = []
  for (const f of args.files) {
    const primaryDate = pickPrimaryDate(f.columns)
    all.push(...suggestionsForFile(f, primaryDate))
  }

  const picked = pickVariety(all, count)

  // Dedup keys
  const seenKeys = new Set<string>()
  return picked.map((b, i) => {
    let key = b.display_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || `kpi_${i + 1}`
    let suffix = 1
    let final = key
    while (seenKeys.has(final)) final = `${key}_${suffix++}`
    seenKeys.add(final)

    return {
      display_name: b.display_name,
      key: final,
      description: b.description,
      formula: b.formula,
      format: b.format,
      viz_type: b.viz_type,
      target: null,
      confidence: 'medium',
      notes: 'Heuristic suggestion — based on column names + types. Edit if the source/column/filter doesn\'t match your intent.',
    }
  })
}
