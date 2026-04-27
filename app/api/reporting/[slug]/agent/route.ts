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

  // Insert a "running" row up front so the UI can poll if we ever go async.
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
  if (insertErr || !insertedRow) {
    return NextResponse.json(
      {
        error:
          insertErr?.message ??
          'Failed to create run. Run migration 018 in Supabase if this is the first time.',
      },
      { status: 500 }
    )
  }
  const runId = insertedRow.id as string

  // Call Claude. Wrap so any error gets persisted on the row instead of
  // being lost in the void.
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

    return NextResponse.json({
      ok: true,
      run: {
        id: runId,
        status: 'succeeded',
        output_markdown: output,
        period_start: context.timeframe.start,
        period_end: context.timeframe.end,
        kpi_snapshot: context.kpi_snapshot,
        model,
      },
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    await supabase
      .from('report_agent_runs')
      .update({
        status: 'failed',
        error_message: errMsg,
        model,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)
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
    // If the table doesn't exist (migration 018 pending), report a friendly
    // error instead of a 500 with a raw Postgres message.
    if (/relation .*report_agent_runs.* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { runs: [], pending_migration: '018_report_agent_runs.sql' },
        { status: 200 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ runs: (data ?? []) as Partial<ReportAgentRun>[] })
}
