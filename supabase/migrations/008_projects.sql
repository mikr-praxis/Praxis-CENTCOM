-- Projects: the central hub tying clients through the pipeline
-- Each project maps to a client, has a pipeline stage, and a Slack tag prefix
-- for pulling messages from any channel that mention the project.

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_tag text,                                                  -- maps to existing tag system (e.g. 'breathe-for-change')
  slack_tag text,                                                   -- prefix used in Slack messages (e.g. '[B4C]')
  slack_channel_id text,                                            -- optional: dedicated Slack channel
  stage text check (stage in (
    'lead', 'discovery', 'proposal', 'onboarded', 'building', 'qa', 'deployed'
  )) default 'lead',
  priority text check (priority in ('high', 'medium', 'low')) default 'medium',
  owner_id text,                                                    -- team member ID (e.g. 'nadeem')
  description text,
  deadline date,
  notes text,
  user_id text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Users see own projects" on projects for all
  using (user_id = current_setting('request.jwt.claims')::json->>'sub');

create index idx_projects_user on projects(user_id);
create index idx_projects_stage on projects(stage);
create index idx_projects_client_tag on projects(client_tag);

-- Seed with current Praxis clients at realistic stages
insert into projects (name, client_tag, slack_tag, stage, priority, owner_id, description, user_id) values
  ('Breathe for Change', 'breathe-for-change', '[B4C]', 'building', 'high', 'nadeem',
   'Education-focused breathwork/wellness — scaling virtual events with paid media and funnel optimization.',
   'user_3BrziAlQGvWKidvMWyaxmXAABZR'),
  ('ManTalks', 'mantalks', '[MT]', 'building', 'high', 'kevin',
   'Connor Beaton''s men''s personal development — multi-day virtual events and community growth.',
   'user_3BrziAlQGvWKidvMWyaxmXAABZR'),
  ('John Wineland', 'john-wineland', '[JW]', 'onboarded', 'medium', 'kevin',
   'Embodiment and relational work — event infrastructure and paid acquisition.',
   'user_3BrziAlQGvWKidvMWyaxmXAABZR'),
  ('Soma Plus IQ', 'soma-plus-iq', '[SOMA]', 'deployed', 'medium', 'nadeem',
   'Three-day live breathwork workshops with high-ticket post-workshop nurture. Nadeem is CEO.',
   'user_3BrziAlQGvWKidvMWyaxmXAABZR'),
  ('Krista Mishore', 'krista-mishore', '[KM]', 'discovery', 'medium', 'nadeem',
   'New client — initial discovery and fit assessment in progress.',
   'user_3BrziAlQGvWKidvMWyaxmXAABZR');
