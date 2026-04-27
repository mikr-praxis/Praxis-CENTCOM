import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/agents'
import { buildAgentContext, buildAgentPrompt } from '@/lib/reporting/agent-context'
import {
  getReportingAIModel,
  getReportingAIMaxTokens,
} from '@/lib/reporting/config'
import type { Timeframe } from '@/lib/reporting/types'
import type { ReportAgentRun } from '@/lib/supabase/types'

/**
 * Maximum tokens this route requests from Anthropic. The model config helper
 * defaults to a generous value for full reports; callers can override per-run
 * but we cap it here so a buggy override can't blow up the agent.
 */
const HARD_MAX_TOKENS_CAP = 8000

/**
 * True if the error indicates the report_agent_runs table doesn't exist OR
 * isn't in the PostgREST schema cache yet. Both surface as different error
 * shapes — the Postgres-level "relation does not exist" and the PostgREST
 * "Could not find the table … in the schema cache" — so we match both.
 */
function isMissingTableError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const msg = (err.message ?? '').toLowerCase()
  if (err.code === 'PGRST205') return true
  return (
    /relation .*report_agent_runs.* does not exist/.test(msg) ||
    /could not find the table .*report_agent_runs.* in the schema cache/.test(msg)
  )
}

/**
 * POST /api/reporting/[slug]/agent
 * Body (all optional): { start?: 'YYYY-MM-DD', end?: 'YYYY-MM-DD' }
 * Generates a fresh weekly report. Inserts a row into report_agent_runs in
 * status='running' before calling Claude, then updates with the output (or
 * an error message) on completion.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { start?: string | null; end?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body is fine */
  }
  const timeframe: Timeframe | undefined =
    body.start || body.end ? { start: body.start ?? null, end: body.end ?? null } : undefined

  // Build prompt context — also resolves the client row (404s if missing).
  let context: Awaited<ReturnType<typeof buildAgentContext>>
  try {
    context = await buildAgentContext(slug, timeframe)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 404 })
  }

  if (context.kpi_snapshot.length === 0) {
    return NextResponse.json(
      { error: 'No KPIs configured for this client. Add at least one before running the agent.' },
      { status: 400 }
    )
  }

  const prompt = buildAgentPrompt(context)
  const supabase = createServerClient()

  // Try to insert a "running" row up front so the UI can poll if we ever go
  // async. If the table is missing (migration 018 pending), fall through
  // and run the agent ephemerally — better to give the user output now than
  // to block on a migration.
  let runId: string | null = null
  let pendingMigration = false
  {
    const { data: insertedRow, error: insertErr } = await supabase
      .from('report_agent_runs')
      .insert({
        client_id: context.client.id,
        period_start: context.timeframe.start,
        period_end: context.timeframe.end,
        kpi_snapshot: context.kpi_snapshot,
        prompt,
        status: 'running',
        created_by: userId,
      })
      .select('id')
      .single()

    if (insertedRow) {
      runId = insertedRow.id as string
    } else if (isMissingTableError(insertErr)) {
      pendingMigration = true
    } else if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // Call Claude. We always do this; only the persistence layer is optional.
  const model = await getReportingAIModel()
  const maxTokens = Math.min(
    await getReportingAIMaxTokens(4000),
    HARD_MAX_TOKENS_CAP
  )

  try {
    const anthropic = await getAnthropicClient()
    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const output = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim()

    if (runId) {
      await supabase
        .from('report_agent_runs')
        .update({
          status: 'succeeded',
          output_markdown: output,
          model,
          input_tokens: message.usage?.input_tokens ?? null,
          output_tokens: message.usage?.output_tokens ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    }

    return NextResponse.json({
      ok: true,
      pending_migration: pendingMigration ? '018_report_agent_runs.sql' : null,
      run: {
        id: runId,
        status: 'succeeded',
        output_markdown: output,
        period_start: context.timeframe.start,
        period_end: context.timeframe.end,
        kpi_snapshot: context.kpi_snapshot,
        model,
        input_tokens: message.usage?.input_tokens ?? null,
        output_tokens: message.usage?.output_tokens ?? null,
      },
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    if (runId) {
      await supabase
        .from('report_agent_runs')
        .update({
          status: 'failed',
          error_message: errMsg,
          model,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    }
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

/**
 * GET /api/reporting/[slug]/agent?limit=20
 * Returns the most recent runs for this client (descending). Used to populate
 * the history dropdown / panel on /reporting/[slug].
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const url = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20))

  const supabase = createServerClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('report_agent_runs')
    .select(
      'id, period_start, period_end, status, model, output_markdown, error_message, kpi_snapshot, input_tokens, output_tokens, created_by, created_at, completed_at'
    )
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    // If the table doesn't exist or PostgREST hasn't refreshed its schema
    // cache yet (migration 018 pending), report a friendly empty list
    // instead of a 500 with a raw Postgres message.
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { runs: [], pending_migration: '018_report_agent_runs.sql' },
        { status: 200 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ runs: (data ?? []) as Partial<ReportAgentRun>[] })
}
