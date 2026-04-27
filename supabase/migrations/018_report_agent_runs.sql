-- Migration 018: report_agent_runs
-- Stores Claude-generated weekly report outputs per reporting client so the
-- /reporting/[slug] page can show history and avoid re-running for free.

create table if not exists report_agent_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  -- Report window the agent summarized:
  period_start date,
  period_end date,
  -- Snapshot of the per-KPI numeric summary that fed the prompt. Lets us
  -- re-render or compare with future runs without recomputing everything.
  kpi_snapshot jsonb not null default '[]'::jsonb,
  -- Final prompt sent to Claude + the markdown response. Stored verbatim
  -- so we can audit and re-display.
  prompt text not null,
  output_markdown text,
  -- Anthropic model id (e.g. claude-opus-4-5-20251101) for traceability
  model text,
  -- Status lifecycle: queued -> running -> succeeded | failed
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  error_message text,
  -- Cost / token usage if Anthropic returned it
  input_tokens int,
  output_tokens int,
  -- Audit
  created_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists report_agent_runs_client_idx
  on report_agent_runs (client_id, created_at desc);

create index if not exists report_agent_runs_status_idx
  on report_agent_runs (status);

-- RLS: service-role only. Same posture as the other reporting tables.
alter table report_agent_runs enable row level security;

drop policy if exists report_agent_runs_service_role on report_agent_runs;
create policy report_agent_runs_service_role on report_agent_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
