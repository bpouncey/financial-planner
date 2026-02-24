/**
 * Export scenario assumptions as JSON for third-party verification.
 */

import type { Household } from "@/lib/types/zod";

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
  const payload = {
    exportedAt: new Date().toISOString(),
    householdName: household.name,
    startYear: household.startYear,
    currency: household.currency,
    scenarios: household.scenarios,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(payload, `scenarios-${date}.json`);
}
