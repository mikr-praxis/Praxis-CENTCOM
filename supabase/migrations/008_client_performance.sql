-- Client Performance Dashboard tables
-- Stores clients, data sources, metric snapshots, and event calendar

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  funnel_type text not null check (funnel_type in ('call', 'webinar', 'challenge')),
  funnel_config jsonb default '{}',
  created_at timestamptz default now()
);

-- Data sources (each Sheet URL or CSV upload)
create table data_sources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  source_type text not null check (source_type in ('google_sheet', 'csv', 'manual')),
  source_url text,
  sheet_name text,
  last_synced_at timestamptz,
  column_mapping jsonb default '{}',
  mapping_status text default 'pending' check (mapping_status in ('pending', 'approved', 'active')),
  created_at timestamptz default now()
);

-- Metric snapshots (one row per metric per date per client)
create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  period_date date not null,
  period_type text default 'week' check (period_type in ('day', 'week', 'month')),
  confidence text default 'direct' check (confidence in ('direct', 'derived', 'estimated')),
  derivation_notes text,
  source_id uuid references data_sources(id),
  created_at timestamptz default now(),
  unique(client_id, metric_key, period_date, period_type)
);

-- Event calendar (upcoming launches, challenges, etc.)
create table client_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  event_name text not null,
  event_date date not null,
  event_type text check (event_type in ('launch', 'challenge', 'webinar', 'sale')),
  notes text
);

-- Indexes for common queries
create index idx_metric_snapshots_client on metric_snapshots(client_id, period_date desc);
create index idx_metric_snapshots_key on metric_snapshots(client_id, metric_key, period_date desc);
create index idx_data_sources_client on data_sources(client_id);
create index idx_client_events_client on client_events(client_id, event_date desc);
create index idx_clients_slug on clients(slug);

-- Seed Mashore as first client (funnel type placeholder — update when confirmed)
insert into clients (slug, name, funnel_type, funnel_config)
values ('mashore', 'Mashore', 'call', '{}');
