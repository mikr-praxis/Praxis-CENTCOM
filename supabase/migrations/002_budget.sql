create table budget_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null,
  cost numeric default 0,
  expense_type text check (expense_type in ('Personal', 'Business')) default 'Business',
  card text,
  user_id text not null,
  created_at timestamptz default now()
);
alter table budget_items enable row level security;
create policy "Users see own budget" on budget_items for all using (user_id = auth.jwt()->>'sub');
