# Supabase Setup — FI/RE Planner

## 1. Run the migration

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/eibwfgvxhheynezmujbf/sql/new).
2. Copy the contents of `supabase/migrations/20250222000000_create_households.sql`.
3. Run the query.

## 2. Configure environment

1. Copy `.env.example` to `.env.local`.
2. Get your **anon key** from [API Settings](https://supabase.com/dashboard/project/eibwfgvxhheynezmujbf/settings/api).
3. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

## 3. Verify connection

```bash
npm run dev
# Then visit: http://localhost:3000/api/supabase/test
```

Expected: `{"ok":true,"message":"Connected to Supabase. households table accessible."}`

## 4. Test persistence

1. Open the app at `http://localhost:3000/setup`.
2. Make changes (e.g., add an account, edit household name).
3. Refresh the page — changes should persist (loaded from Supabase).

## Architecture

- **households** table: `id`, `data` (JSONB), `active_scenario_id`, timestamps
- **SupabaseHydration** component loads on mount and saves changes (debounced 500ms)
- RLS is permissive for anon; tighten when adding auth
