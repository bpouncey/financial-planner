"use client";

import { useHouseholdStore } from "@/stores/household";
import { validateHousehold } from "@/lib/model/validation";

export function ValidationBanner() {
  const household = useHouseholdStore((s) => s.household);
  const activeScenarioId = useHouseholdStore((s) => s.activeScenarioId);
  const scenario =
    activeScenarioId != null
      ? household.scenarios.find((s) => s.id === activeScenarioId) ?? null
      : null;

  if (!scenario) return null;

  const { errors, warnings } = validateHousehold(household, scenario);

  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/50"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Cannot run projection — fix these issues first:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
            {errors.map((e) => (
              <li key={e.code}>{e.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            No disappearing dollars: every contribution must reference an existing
            account.
          </p>
        </div>
      )}
      {warnings.length > 0 && errors.length === 0 && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/50"
        >
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Warnings:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
