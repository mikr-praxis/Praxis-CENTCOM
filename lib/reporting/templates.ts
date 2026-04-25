/**
 * KPI templates — pre-defined dashboards that auto-resolve their data sources
 * from a client's synced files based on filename + column-name signals.
 *
 * Each template defines a set of "roles" (e.g. 'registrations', 'attendees',
 * 'purchases', 'ad_spend') and a list of KPI builders that reference those
 * roles. The resolver scores each file × role pair and picks the best match.
 *
 * Output is the same shape as AISuggestion[] so the existing review/save flow
 * (BuildModal in clients-home) handles templates without any UI plumbing.
 */

import type { Formula, AggOp, Filter } from './types'
import type { AISuggestion, FileForSuggester } from './ai-suggest'

/* ───────────────────────────── Types ───────────────────────────── */

interface RoleSignals {
  /** Filename regex hints — increase score when the file looks role-relevant. */
  file_patterns?: RegExp[]
  /** Required-ish column types: a column matching at least one pattern is needed. */
  column_signals?: Record<string, RegExp[]>
  /** Column-value patterns (e.g. attended values look like 'yes/no/attended'). */
  value_signals?: Record<string, RegExp[]>
}

interface ResolvedRole {
  filename: string
  /** Best column for each named signal (e.g. {email: 'Email', timestamp: 'Created At'}) */
  columns: Record<string, string>
  score: number
}

type ResolvedRoles = Record<string, ResolvedRole | null>

interface KPITemplateItem {
  key: string
  display_name: string
  description: string
  format: 'count' | 'currency' | 'percent' | 'ratio'
  viz_type: 'card' | 'line' | 'bar' | 'pie' | 'table'
  required_roles: string[]
  /**
   * Builder that produces a Formula given the resolved roles. Returns null if
   * the resolution is incomplete and the KPI should be skipped.
   */
  build: (roles: ResolvedRoles) => Formula | null
  /** Optional notes shown to the user. */
  notes?: string
}

export interface KPITemplate {
  id: string
  name: string
  description: string
  industry: 'marketing_webinar' | 'sales_funnel' | 'ecommerce' | 'paid_media' | 'general'
  roles: Record<string, RoleSignals>
  kpis: KPITemplateItem[]
}

/* ───────────────────────────── Resolver ───────────────────────────── */

function pickBestColumn(
  columns: string[],
  patterns: RegExp[]
): string | null {
  if (!patterns || patterns.length === 0) return null
  const scored = columns.map((c) => {
    let score = 0
    for (const p of patterns) {
      if (p.test(c)) score += 1
    }
    // Prefer shorter (e.g. "email" over "secondary_email_address")
    if (score > 0) score -= c.length / 100
    return { column: c, score }
  })
  scored.sort((a, b) => b.score - a.score)
  if (scored[0]?.score > 0) return scored[0].column
  return null
}

function valuesLookLikeBoolean(values: string[]): boolean {
  if (!values.length) return false
  const lower = values.map((v) => String(v).toLowerCase().trim())
  const set = new Set(lower)
  const positives = ['true', 'yes', 'y', '1', 'attended', 'live']
  const negatives = ['false', 'no', 'n', '0', 'absent', 'no-show']
  const hasPos = positives.some((p) => set.has(p))
  const hasNeg = negatives.some((n) => set.has(n))
  return hasPos && hasNeg && set.size <= 6
}

/**
 * Score a file × role pairing. Higher score = better match.
 */
function scoreFileForRole(
  file: FileForSuggester,
  signals: RoleSignals
): { score: number; columns: Record<string, string> } {
  let score = 0
  const columns: Record<string, string> = {}

  // Filename hints
  if (signals.file_patterns) {
    for (const p of signals.file_patterns) {
      if (p.test(file.filename)) score += 3
    }
  }

  // Column hints (each signal name = role's required column)
  if (signals.column_signals) {
    for (const [signalName, patterns] of Object.entries(signals.column_signals)) {
      const col = pickBestColumn(file.columns, patterns)
      if (col) {
        columns[signalName] = col
        score += 2
      }
    }
  }

  // Value hints (boolean-like columns named e.g. "attended")
  if (signals.value_signals) {
    for (const [signalName, patterns] of Object.entries(signals.value_signals)) {
      const col = pickBestColumn(file.columns, patterns)
      if (col) {
        const sampleValues = file.sample_rows.map((r) => String(r[col] ?? '')).filter(Boolean)
        if (valuesLookLikeBoolean(sampleValues)) {
          columns[signalName] = col
          score += 2
        }
      }
    }
  }

  return { score, columns }
}

export function resolveRoles(
  template: KPITemplate,
  files: FileForSuggester[]
): ResolvedRoles {
  const out: ResolvedRoles = {}
  for (const [roleName, signals] of Object.entries(template.roles)) {
    let best: ResolvedRole | null = null
    for (const f of files) {
      const { score, columns } = scoreFileForRole(f, signals)
      if (score === 0) continue
      if (!best || score > best.score) {
        best = { filename: f.filename, columns, score }
      }
    }
    out[roleName] = best
  }
  return out
}

/* ───────────────────────────── Helpers for KPI builders ───────────────────────────── */

function dateColumn(role: ResolvedRole | null): string | undefined {
  return role?.columns.timestamp ?? role?.columns.date ?? undefined
}

function attendedFilter(role: ResolvedRole): Filter | null {
  const col = role.columns.attended
  if (!col) return null
  // Best-effort filter against common positive values; engine compares
  // case-insensitively, so this catches "Yes", "true", "Attended" etc.
  const f: Filter = {
    column: col,
    op: 'in',
    value: ['true', 'yes', 'y', '1', 'attended', 'live'],
  }
  return f
}

function purchaseFilter(role: ResolvedRole): Filter | null {
  const col = role.columns.status
  if (!col) return null
  const f: Filter = {
    column: col,
    op: 'in',
    value: ['paid', 'completed', 'success', 'won', 'closed', 'closed_won'],
  }
  return f
}

/* ───────────────────────────── Template: Marketing Webinar ───────────────────────────── */

const marketingWebinar: KPITemplate = {
  id: 'marketing_webinar',
  name: 'Marketing Webinar',
  description: '5 standard webinar funnel KPIs: registrations → show-up → conversion → CPR → ROAS.',
  industry: 'marketing_webinar',
  roles: {
    registrations: {
      file_patterns: [/regist/i, /signup/i, /opt[\s_-]?in/i, /lead/i, /form[\s_-]?submission/i, /hubspot/i],
      column_signals: {
        email: [/email/i],
        timestamp: [/registered/i, /signup/i, /opt[\s_-]?in/i, /created/i, /submission[\s_-]?date/i, /_at$/i, /^date$/i],
      },
    },
    attendees: {
      file_patterns: [/attend/i, /webinar/i, /zoom/i, /everwebinar/i, /webinarjam/i, /live/i],
      column_signals: {
        email: [/email/i],
        timestamp: [/joined/i, /attended/i, /_at$/i, /date/i, /time/i],
      },
      value_signals: {
        attended: [/attend/i, /live/i, /joined/i, /show[\s_-]?up/i, /^attendance$/i, /status/i],
      },
    },
    purchases: {
      file_patterns: [/sale/i, /purchase/i, /order/i, /transaction/i, /payment/i, /deal/i, /revenue/i, /stripe/i],
      column_signals: {
        amount: [/amount/i, /revenue/i, /total/i, /price/i, /value/i, /paid/i, /\$/],
        email: [/email/i, /customer/i],
        timestamp: [/paid[\s_-]?at/i, /purchased[\s_-]?at/i, /closed[\s_-]?at/i, /_at$/i, /date/i],
        status: [/status/i, /stage/i, /state/i, /outcome/i],
      },
    },
    ad_spend: {
      file_patterns: [/spend/i, /\bcost\b/i, /^ad/i, /campaign/i, /meta/i, /facebook/i, /google[\s_-]?ads/i, /paid[\s_-]?media/i],
      column_signals: {
        amount: [/spend/i, /\bcost\b/i, /amount/i, /\$/],
        timestamp: [/_at$/i, /date/i],
      },
    },
  },
  kpis: [
    {
      key: 'webinar_total_registrations',
      display_name: 'Total Registrations',
      description: 'Total registrations from your registration source.',
      format: 'count',
      viz_type: 'card',
      required_roles: ['registrations'],
      build: (roles) => {
        const reg = roles.registrations
        if (!reg) return null
        const op: AggOp = {
          op: 'count',
          source: reg.filename,
          filters: [],
          ...(dateColumn(reg) ? { timeframe_column: dateColumn(reg)! } : {}),
        }
        return op
      },
      notes: 'Counts every row in the registrations file; if the file has duplicates, switch to count_distinct on the email column.',
    },
    {
      key: 'webinar_show_up_rate',
      display_name: 'Show-Up Rate',
      description: 'Percent of registrants who actually attended live.',
      format: 'percent',
      viz_type: 'card',
      required_roles: ['registrations', 'attendees'],
      build: (roles) => {
        const reg = roles.registrations
        const att = roles.attendees
        if (!reg) return null
        // If attendees is a separate file: numerator = count attendees, denominator = count regs
        // If attendees flag is on the registrations file: numerator = count where attended, denominator = count
        const sameFile = att && att.filename === reg.filename
        const attendedFlag = att ? attendedFilter(att) : null

        const numerator: AggOp = sameFile && attendedFlag
          ? {
              op: 'count',
              source: reg.filename,
              filters: [attendedFlag],
              ...(dateColumn(reg) ? { timeframe_column: dateColumn(reg)! } : {}),
            }
          : att
            ? {
                op: 'count',
                source: att.filename,
                filters: [],
                ...(dateColumn(att) ? { timeframe_column: dateColumn(att)! } : {}),
              }
            : null
        if (!numerator) return null
        const denominator: AggOp = {
          op: 'count',
          source: reg.filename,
          filters: [],
          ...(dateColumn(reg) ? { timeframe_column: dateColumn(reg)! } : {}),
        }
        return { op: 'divide', numerator, denominator }
      },
      notes: 'Numerator is attendees (via separate file or attended-flag column); denominator is registrations.',
    },
    {
      key: 'webinar_conversion_rate',
      display_name: 'Conversion Rate',
      description: 'Percent of attendees (or registrants if no attendee data) who became customers.',
      format: 'percent',
      viz_type: 'card',
      required_roles: ['registrations', 'purchases'],
      build: (roles) => {
        const reg = roles.registrations
        const att = roles.attendees
        const pur = roles.purchases
        if (!pur || !reg) return null
        const purStatusFilter = purchaseFilter(pur)
        const numerator: AggOp = {
          op: 'count',
          source: pur.filename,
          filters: purStatusFilter ? [purStatusFilter] : [],
          ...(dateColumn(pur) ? { timeframe_column: dateColumn(pur)! } : {}),
        }
        // Denominator: attendees if available, else registrations
        const sameFile = att && att.filename === reg.filename
        const attendedFlag = att ? attendedFilter(att) : null
        const denominator: AggOp = att
          ? sameFile && attendedFlag
            ? {
                op: 'count',
                source: reg.filename,
                filters: [attendedFlag],
                ...(dateColumn(reg) ? { timeframe_column: dateColumn(reg)! } : {}),
              }
            : {
                op: 'count',
                source: att.filename,
                filters: [],
                ...(dateColumn(att) ? { timeframe_column: dateColumn(att)! } : {}),
              }
          : {
              op: 'count',
              source: reg.filename,
              filters: [],
              ...(dateColumn(reg) ? { timeframe_column: dateColumn(reg)! } : {}),
            }
        return { op: 'divide', numerator, denominator }
      },
      notes: 'Numerator is purchases (filtered to "paid"/"won" if a status column exists). Denominator is attendees if found, else registrations.',
    },
    {
      key: 'webinar_cost_per_registration',
      display_name: 'Cost per Registration',
      description: 'Ad spend divided by total registrations.',
      format: 'currency',
      viz_type: 'card',
      required_roles: ['ad_spend', 'registrations'],
      build: (roles) => {
        const spend = roles.ad_spend
        const reg = roles.registrations
        if (!spend || !reg || !spend.columns.amount) return null
        const numerator: AggOp = {
          op: 'sum',
          source: spend.filename,
          column: spend.columns.amount,
          filters: [],
          ...(dateColumn(spend) ? { timeframe_column: dateColumn(spend)! } : {}),
        }
        const denominator: AggOp = {
          op: 'count',
          source: reg.filename,
          filters: [],
          ...(dateColumn(reg) ? { timeframe_column: dateColumn(reg)! } : {}),
        }
        return { op: 'divide', numerator, denominator }
      },
      notes: 'Sum of spend column ÷ registration count. Output formatted as currency.',
    },
    {
      key: 'webinar_roas',
      display_name: 'ROAS',
      description: 'Total revenue divided by total ad spend.',
      format: 'ratio',
      viz_type: 'card',
      required_roles: ['ad_spend', 'purchases'],
      build: (roles) => {
        const spend = roles.ad_spend
        const pur = roles.purchases
        if (!spend || !pur || !spend.columns.amount || !pur.columns.amount) return null
        const purStatusFilter = purchaseFilter(pur)
        const numerator: AggOp = {
          op: 'sum',
          source: pur.filename,
          column: pur.columns.amount,
          filters: purStatusFilter ? [purStatusFilter] : [],
          ...(dateColumn(pur) ? { timeframe_column: dateColumn(pur)! } : {}),
        }
        const denominator: AggOp = {
          op: 'sum',
          source: spend.filename,
          column: spend.columns.amount,
          filters: [],
          ...(dateColumn(spend) ? { timeframe_column: dateColumn(spend)! } : {}),
        }
        return { op: 'divide', numerator, denominator }
      },
      notes: 'Revenue (sum of amount on paid purchases) ÷ ad spend. Ratio: 3.5 means $3.50 returned per $1 spent.',
    },
  ],
}

/* ───────────────────────────── Public API ───────────────────────────── */

export const TEMPLATES: KPITemplate[] = [marketingWebinar]

export function getTemplate(id: string): KPITemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}

/**
 * Apply a template to a set of synced files. Returns suggestions in the same
 * shape as the AI/heuristic suggesters. Skips KPIs whose required roles
 * couldn't be resolved.
 */
export function applyTemplate(args: {
  template: KPITemplate
  files: FileForSuggester[]
}): { suggestions: AISuggestion[]; resolved: ResolvedRoles; missing_roles: string[] } {
  const resolved = resolveRoles(args.template, args.files)
  const missing_roles: string[] = []
  for (const [role, r] of Object.entries(resolved)) {
    if (!r) missing_roles.push(role)
  }

  const suggestions: AISuggestion[] = []
  for (const item of args.template.kpis) {
    const allRolesResolved = item.required_roles.every((r) => !!resolved[r])
    if (!allRolesResolved) continue
    const formula = item.build(resolved)
    if (!formula) continue

    // Confidence: roughly proportional to matching score
    const avgScore =
      item.required_roles.reduce((acc, r) => acc + (resolved[r]?.score ?? 0), 0) /
      item.required_roles.length
    const confidence = avgScore >= 5 ? 'high' : avgScore >= 3 ? 'medium' : 'low'

    suggestions.push({
      display_name: item.display_name,
      key: item.key,
      description: item.description,
      formula,
      format: item.format,
      viz_type: item.viz_type,
      target: null,
      confidence,
      notes: [
        item.notes ?? '',
        `Sources: ${item.required_roles
          .map((r) => `${r}=${resolved[r]?.filename ?? '?'}`)
          .join(', ')}`,
      ]
        .filter(Boolean)
        .join(' '),
    })
  }

  return { suggestions, resolved, missing_roles }
}
