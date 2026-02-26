/**
 * Export scenario assumptions as JSON for third-party verification.
 * Scenarios are resolved to effective values (engine defaults applied) so
 * the export matches exactly what runProjection uses for calculations.
 */

import type { Household } from "@/lib/types/zod";
import { getEffectiveScenarioForExport } from "@/lib/model/effective-scenario";

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export scenarios and household metadata for verification. */
export function downloadScenariosJson(household: Household): void {
  const effectiveScenarios = household.scenarios.map((s) =>
    getEffectiveScenarioForExport(household, s)
  );
  const payload = {
    exportedAt: new Date().toISOString(),
    householdName: household.name,
    startYear: household.startYear,
    currency: household.currency,
    scenarios: effectiveScenarios,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(payload, `scenarios-${date}.json`);
}
