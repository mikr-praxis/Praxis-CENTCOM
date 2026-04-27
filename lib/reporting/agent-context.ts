/**
 * Build the per-client weekly-report context fed to Claude.
 *
 * Lifts data from the same engine the dashboard uses, but forces
 * `compare_to: 'previous_period'` on every KPI so the LLM sees a clean
 * current-period vs prior-period delta even if the user's saved KPI defs
 * don't request comparison. We then condense everything into a small JSON
 * shape — no raw rows, just summary stats — so the prompt stays well under
 * the model's context window.
 */

import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI, formatKPIValue } from './engine'
import type {
  KPIDefinition,
  Timeframe,
  RawFileForEngine,
  Formula,
} from './types'
import type {
  ReportKPI,
  ReportRawFile,
  ChartOptions,
  ReportAgentKPISnapshot,
} from '@/lib/supabase/types'
import { getBrandingConfig } from '@/lib/branding'

export interface AgentContext {
  client: { id: string; slug: string; name: string }
  timeframe: Timeframe
  prior_timeframe: Timeframe
  /** ISO date strings, formatted in the configured app date locale. */
  display_period: { start: string; end: string }
  display_prior_period: { start: string; end: string }
  /** Full KPI snapshot with current+prior values + delta. Saved on the run. */
  kpi_snapshot: ReportAgentKPISnapshot[]
  /** Filename, row count and modified time for each synced file. */
  files: { filename: string; row_count: number; modified_time: string | null }[]
  branding: { app_name: string; currency_code: string }
}

/**
 * Default report window: the last 7 full days, ending yesterday so we don't
 * partially count today and skew the comparison. Returns `YYYY-MM-DD`.
 */
export function defaultWeeklyTimeframe(now: Date = new Date()): Timeframe {
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - 1) // yesterday
  const start = new Date(end)
  start.setDate(start.getDate() - 6) // 7 days inclusive
  return {
    start: bucketKey(start),
    end: bucketKey(end),
  }
}

function bucketKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rowToDefinition(r: ReportKPI): KPIDefinition {
  return {
    id: r.id,
    client_id: r.client_id,
    key: r.key,
    display_name: r.display_name,
    description: r.description,
    formula: r.formula as unknown as Formula,
    format: r.format,
    target: r.target,
    viz_type: r.viz_type,
    display_order: r.display_order,
    group_by_column: r.group_by_column ?? null,
    group_by_source: r.group_by_source ?? null,
    // Force previous-period compare so the LLM always gets a delta.
    compare_to: 'previous_period',
    forecast_periods: r.forecast_periods ?? 0,
    forecast_method: r.forecast_method ?? null,
    chart_options: (r.chart_options ?? {}) as ChartOptions,
  }
}

function rowToFileForEngine(
  r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>
): RawFileForEngine {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    rows: Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [],
  }
}

/**
 * Pull the per-client agent context. Throws if the client doesn't exist.
 */
export async function buildAgentContext(
  slug: string,
  timeframe?: Timeframe
): Promise<AgentContext> {
  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, slug, name')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    throw new Error(`Client not found: ${slug}`)
  }

  const tf = timeframe ?? defaultWeeklyTimeframe()
  const branding = await getBrandingConfig().catch(() => null)

  const [{ data: kpiRows }, { data: fileRows }] = await Promise.all([
    supabase
      .from('report_kpis')
      .select('*')
      .or(`client_id.eq.${client.id},client_id.is.null`)
      .order('display_order', { ascending: true }),
    supabase
      .from('report_raw_files')
      .select('filename, columns, rows, row_count, modified_time')
      .eq('client_id', client.id),
  ])

  const files = (fileRows ?? []).map(rowToFileForEngine)
  const definitions = (kpiRows ?? []).map(rowToDefinition)

  const snapshot: ReportAgentKPISnapshot[] = []
  for (const def of definitions) {
    const result = evaluateKPI(def, files, tf)
    const current = result.value
    const prior = result.compare?.previous_value ?? null
    const delta_pct = result.compare?.delta_percent ?? null
    snapshot.push({
      key: def.key,
      display_name: def.display_name,
      format: def.format,
      current,
      prior,
      delta_pct,
      target: def.target,
    })
  }

  // Build prior timeframe for display
  const priorStart = tf.start ? shiftDate(tf.start, periodSpanDays(tf) * -1 - 1) : null
  const priorEnd = tf.start ? shiftDate(tf.start, -1) : null

  return {
    client: { id: client.id, slug: client.slug, name: client.name },
    timeframe: tf,
    prior_timeframe: { start: priorStart, end: priorEnd },
    display_period: { start: tf.start ?? '', end: tf.end ?? '' },
    display_prior_period: { start: priorStart ?? '', end: priorEnd ?? '' },
    kpi_snapshot: snapshot,
    files: (fileRows ?? []).map((r) => ({
      filename: r.filename,
      row_count: r.row_count ?? 0,
      modified_time: r.modified_time ?? null,
    })),
    branding: {
      app_name: branding?.app_name ?? 'Praxis',
      currency_code: branding?.kpi_currency_code ?? 'USD',
    },
  }
}

function periodSpanDays(tf: Timeframe): number {
  if (!tf.start || !tf.end) return 7
  const a = new Date(tf.start).getTime()
  const b = new Date(tf.end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 7
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)))
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  return bucketKey(d)
}

/**
 * Produce the human-readable prompt fed to Claude. Embedded JSON keeps
 * the values pre-formatted so the model doesn't have to do string math.
 */
export function buildAgentPrompt(ctx: AgentContext): string {
  const fmtCurrency = ctx.branding.currency_code

  const lines: string[] = []
  lines.push(
    `You are the ${ctx.branding.app_name} client reporting AI. Generate a weekly executive summary for ${ctx.client.name}.`
  )
  lines.push('')
  lines.push(
    `**Reporting period:** ${ctx.display_period.start} → ${ctx.display_period.end}  ` +
      `(prior: ${ctx.display_prior_period.start} → ${ctx.display_prior_period.end})`
  )
  lines.push('')
  lines.push('**KPI snapshot (current vs prior period):**')
  if (ctx.kpi_snapshot.length === 0) {
    lines.push('- No KPIs configured yet for this client.')
  } else {
    for (const k of ctx.kpi_snapshot) {
      const cur =
        k.current == null
          ? '—'
          : formatKPIValue(k.current, k.format as 'count' | 'currency' | 'percent' | 'ratio', {
              currency: fmtCurrency,
            })
      const pri =
        k.prior == null
          ? '—'
          : formatKPIValue(k.prior, k.format as 'count' | 'currency' | 'percent' | 'ratio', {
              currency: fmtCurrency,
            })
      const delta =
        k.delta_pct == null
          ? ''
          : ` (${k.delta_pct >= 0 ? '+' : ''}${(k.delta_pct * 100).toFixed(1)}%)`
      const target =
        k.target == null
          ? ''
          : ` · target ${formatKPIValue(k.target, k.format as 'count' | 'currency' | 'percent' | 'ratio', { currency: fmtCurrency })}`
      lines.push(`- **${k.display_name}** — ${cur} vs ${pri}${delta}${target}`)
    }
  }
  lines.push('')
  lines.push('**Source data:**')
  if (ctx.files.length === 0) {
    lines.push('- No synced files yet.')
  } else {
    for (const f of ctx.files) {
      const ts = f.modified_time ? ` (modified ${f.modified_time.slice(0, 10)})` : ''
      lines.push(`- \`${f.filename}\` — ${f.row_count.toLocaleString()} rows${ts}`)
    }
  }
  lines.push('')
  lines.push(
    [
      'Write a concise executive weekly report (≈300–400 words) with these sections:',
      '',
      '1. **Headline** — one sentence capturing the most important shift this week.',
      '2. **What worked** — 2–3 bullets on KPIs that moved up vs prior period and the likely driver.',
      '3. **What needs attention** — 2–3 bullets on KPIs that dropped or are below target.',
      '4. **Recommendations** — 2–3 specific, actionable next steps for the team.',
      '',
      'Rules:',
      '- Use only the KPI numbers above; never invent figures.',
      '- Reference KPIs by their display name.',
      '- Skip any section if there’s nothing material to say (don’t pad).',
      '- Tone: warm, confident, direct. No hype, no corporate filler.',
    ].join('\n')
  )

  return lines.join('\n')
}
