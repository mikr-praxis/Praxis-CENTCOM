-- Team calendars: stores Google Calendar emails for each employee
-- The OAuth2-authenticated user (mscott@builtbypraxis.com) reads these calendars.
-- Team members must share their calendar with mscott@builtbypraxis.com.

create table if not exists team_calendars (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  color text not null default '#8b5cf6',
  role text,                        -- e.g. 'Co-Founder', 'Team Member'
  is_ops boolean default false,     -- true for the main ops@builtbypraxis.com calendar
  enabled boolean default true,     -- toggle visibility without deleting
  source text default 'oauth',           -- 'oauth' (via refresh token)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table team_calendars enable row level security;

-- All authenticated users can read team calendars (it's an org-wide view)
create policy "Authenticated users can read team calendars"
  on team_calendars for select to authenticated using (true);

-- Only service role can manage
create policy "Service role manages team calendars"
  on team_calendars for all to service_role using (true) with check (true);

-- Seed with the Praxis team
insert into team_calendars (email, display_name, color, role, is_ops) values
  ('ops@builtbypraxis.com',      'Praxis Ops',   '#f59e0b', 'Ops Calendar',  true),
  ('mscott@builtbypraxis.com',   'Mikr',         '#8b5cf6', 'Admin',         false),
  ('nadeem@builtbypraxis.com',   'Nadeem',       '#ef4444', 'Co-Founder',    false),
  ('kevin@builtbypraxis.com',    'Kevin',        '#3b82f6', 'Co-Founder',    false),
  ('derek@builtbypraxis.com',    'Derek',        '#10b981', 'Co-Founder',    false),
  ('hillary@builtbypraxis.com',  'Hillary',      '#ec4899', 'Team Member',   false),
  ('victoria@builtbypraxis.com', 'Victoria',     '#f97316', 'Team Member',   false)
on conflict (email) do update set
  display_name = excluded.display_name,
  color = excluded.color,
  role = excluded.role,
  is_ops = excluded.is_ops,
  updated_at = now();
