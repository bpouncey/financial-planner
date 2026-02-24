"use client";

import { useHouseholdStore } from "@/stores/household";
import { validateHousehold } from "@/lib/model/validation";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TriangleAlert } from "lucide-react";

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
        <Alert
          variant="destructive"
          className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/50"
        >
          <AlertCircle className="size-4" />
          <AlertTitle className="text-red-800 dark:text-red-200">
            Cannot run projection — fix these issues first:
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-red-700 dark:text-red-300">
              {errors.map((e) => (
                <li key={e.code}>{e.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              No disappearing dollars: every contribution must reference an
              existing account.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && errors.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
          <TriangleAlert className="size-4" />
          <AlertTitle>Warnings:</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-700 dark:text-amber-300">
              {warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{w.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
