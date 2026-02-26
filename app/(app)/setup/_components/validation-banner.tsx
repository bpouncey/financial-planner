"use client";

import { useHouseholdStore } from "@/stores/household";
import { validateHousehold } from "@/lib/model/validation";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TriangleAlert, Info } from "lucide-react";

export function ValidationBanner() {
  const household = useHouseholdStore((s) => s.household);
  const activeScenarioId = useHouseholdStore((s) => s.activeScenarioId);
  const projection = useHouseholdStore((s) => s.projection);
  const planProjection = useHouseholdStore((s) => s.planProjection);
  const scenario =
    activeScenarioId != null
      ? household.scenarios.find((s) => s.id === activeScenarioId) ?? null
      : null;

  if (!scenario) return null;

  const { errors: preRunErrors, warnings: preRunWarnings } = validateHousehold(
    household,
    scenario
  );

  // Merge post-run validation (e.g. CASHFLOW_NOT_RECONCILED) from both projections
  const postRunErrors = [
    ...(projection?.validation?.errors ?? []),
    ...(planProjection?.validation?.errors ?? []),
  ];
  const postRunWarnings = [
    ...(projection?.validation?.warnings ?? []),
    ...(planProjection?.validation?.warnings ?? []),
  ];
  const postRunAssumptions = [
    ...(projection?.validation?.assumptions ?? []),
    ...(planProjection?.validation?.assumptions ?? []),
  ];
  const seenCodes = new Set<string>();
  const assumptions = postRunAssumptions.filter((a) => {
    if (seenCodes.has(a.code)) return false;
    seenCodes.add(a.code);
    return true;
  });
  const errors = [...preRunErrors, ...postRunErrors];
  const warnings = [...preRunWarnings, ...postRunWarnings];

  if (errors.length === 0 && warnings.length === 0 && assumptions.length === 0)
    return null;

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
              {errors.map((e, i) => (
                <li key={`${e.code}-${i}`}>{e.message}</li>
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
      {assumptions.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-200">
          <Info className="size-4" />
          <AlertTitle>Assumptions (verify as needed):</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-blue-700 dark:text-blue-300">
              {assumptions.map((a, i) => (
                <li key={`${a.code}-${i}`}>{a.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
