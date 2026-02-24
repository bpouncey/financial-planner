-- Add plan_scenario_id column for FOO/plan projection scenario.
-- Defaults to null; app uses first scenario when null (backward compatible).

alter table public.households
  add column if not exists plan_scenario_id text;
