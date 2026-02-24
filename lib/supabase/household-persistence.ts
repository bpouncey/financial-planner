/**
 * Persistence layer for household data to Supabase.
 * Load on init, debounced save on changes.
 */

import type { Household } from "@/lib/types/zod";
import { getSupabase } from "./client";
import { HouseholdSchema } from "@/lib/types/zod";

const HOUSEHOLD_KEY = "default";

export interface PersistedHousehold {
  household: Household;
  activeScenarioId: string | null;
}

export async function loadHousehold(): Promise<PersistedHousehold | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("households")
    .select("data, active_scenario_id")
    .eq("id", HOUSEHOLD_KEY)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    if (error.code === "PGRST205")
      console.error(
        "[Supabase] Load error: Table 'households' not found. Run the migration in Supabase SQL Editor: supabase/migrations/20250222000000_create_households.sql"
      );
    else
      console.error("[Supabase] Load error:", error.message ?? error.code ?? error);
    return null;
  }

  if (!data?.data) return null;
  const parsed = HouseholdSchema.safeParse(data.data);
  if (!parsed.success) {
    console.error("[Supabase] Invalid household data:", parsed.error);
    return null;
  }
  return {
    household: parsed.data,
    activeScenarioId: data.active_scenario_id ?? null,
  };
}

export async function saveHousehold(
  household: Household,
  activeScenarioId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  const { error } = await supabase
    .from("households")
    .upsert(
      {
        id: HOUSEHOLD_KEY,
        data: household,
        active_scenario_id: activeScenarioId,
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("[Supabase] Save error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
