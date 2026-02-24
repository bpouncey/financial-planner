/**
 * Export multi-scenario comparison data as JSON for third-party verification.
 */

import type { ProjectionResult } from "@/lib/model/engine";
import type { Household, Scenario } from "@/lib/types/zod";

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

export interface CompareExportInput {
  scenarioId: string;
  scenarioName: string;
  scenario: Scenario;
  projection: ProjectionResult;
}

/** Export selected scenarios and their full projections for verification. */
export function downloadCompareJson(
  household: Household,
  items: CompareExportInput[]
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    householdName: household.name,
    startYear: household.startYear,
    currency: household.currency,
    comparedScenarios: items.map(({ scenarioId, scenarioName, scenario, projection }) => ({
      scenarioId,
      scenarioName,
      assumptions: scenario,
      projection: {
        yearRows: projection.yearRows,
        fiNumber: projection.fiNumber,
        fiYear: projection.fiYear,
        coastFiYear: projection.coastFiYear,
        savingsRate: projection.savingsRate,
      },
    })),
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(payload, `scenario-comparison-${date}.json`);
}
