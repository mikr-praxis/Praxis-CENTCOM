-- Reporting v2: slicers / group-by / period-over-period / forecasting / saved views

-- 1. Extend report_kpis with: group-by column, PoP comparison flag, forecast settings
alter table report_kpis
  add column if not exists group_by_column text,
  add column if not exists group_by_source text,
  add column if not exists compare_to text check (compare_to in ('previous_period','previous_year')),
  add column if not exists forecast_periods int default 0,
  add column if not exists forecast_method text check (forecast_method in ('linear','moving_avg'));

-- 2. Saved views — named filter+timeframe presets per client
create table if not exists report_views (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  timeframe jsonb,         -- { preset, start, end, event? }
  slicers jsonb default '[]', -- [{ filename, column, values: [..] }]
  selected_filenames jsonb default '[]',
  is_default boolean default false,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_report_views_client on report_views(client_id, created_at desc);

alter table report_views enable row level security;
