"use client";

import { useEffect, useRef } from "react";
import { useHouseholdStore } from "@/stores/household";
import { loadHousehold, saveHousehold } from "@/lib/supabase/household-persistence";

const SAVE_DEBOUNCE_MS = 500;

export function SupabaseHydration() {
  const loaded = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadHousehold().then((persisted) => {
      if (persisted) {
        useHouseholdStore.getState().setHousehold(persisted.household);
        if (persisted.activeScenarioId) {
          useHouseholdStore.getState().setActiveScenarioId(persisted.activeScenarioId);
        }
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = useHouseholdStore.subscribe((state) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null;
        saveHousehold(state.household, state.activeScenarioId);
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      unsubscribe();
    };
  }, []);

  return null;
}
