-- Households table for FI/RE Planner persistence.
-- Stores full household JSON; RLS can be tightened when auth is added.

create table if not exists public.households (
  id text primary key default 'default',
  data jsonb not null,
  active_scenario_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS (permissive for now; anon can read/write)
alter table public.households enable row level security;

-- Allow anon access for development (replace with user-based policies when auth added)
create policy "Allow anon read" on public.households
  for select using (true);

create policy "Allow anon insert" on public.households
  for insert with check (true);

create policy "Allow anon update" on public.households
  for update using (true);

create policy "Allow anon delete" on public.households
  for delete using (true);

-- Trigger to bump updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();
