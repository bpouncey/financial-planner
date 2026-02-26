/**
 * Golden snapshot tests per Accuracy MVP Phase 9.
 * Snapshots projection outputs for base, RSU, and employer-match scenarios.
 * Run: pnpm test golden-snapshots
 */

import { describe, it, expect } from "vitest";
import { runProjection } from "./engine";
import { projectionToCsv } from "@/lib/utils/export-projection";
import {
  getBaseScenario,
  getRsuScenario,
  getEmployerMatchScenario,
} from "@/fixtures/golden-scenarios";

const HORIZON_YEARS = 15;

/** Build snapshot payload: CSV for first N years + summary. */
function buildSnapshotPayload(
  scenarioName: string,
  result: ReturnType<typeof runProjection>,
  household: Parameters<typeof runProjection>[0]
): string {
  const csv = projectionToCsv(result, household);
  // Keep first 20 lines (header + ~15 data rows) plus validation section
  const lines = csv.split("\n");
  const dataEnd = Math.min(lines.findIndex((l) => l.startsWith("---")) ?? lines.length, 20);
  const dataSection = lines.slice(0, dataEnd).join("\n");
  const validationSection = lines.includes("--- Validation ---")
    ? "\n" + lines.slice(lines.indexOf("--- Validation ---")).join("\n")
    : "";

  return `Scenario: ${scenarioName}\nfiNumber: ${result.fiNumber}\nfiYear: ${result.fiYear ?? "null"}\nretirementStartYear: ${result.retirementStartYear ?? "null"}\nfiNotMetAtRetirementAge: ${result.fiNotMetAtRetirementAge}\n\n${dataSection}${validationSection}`;
}

describe("Golden snapshots", () => {
  it("base scenario: no RSU, no employer match", () => {
    const { household, scenario } = getBaseScenario();
    const result = runProjection(household, scenario, HORIZON_YEARS);
    const payload = buildSnapshotPayload("base", result, household);

    // Assert reconciliation holds
    const accumulationRows = result.yearRows.filter((r) => r.phase === "accumulation");
    for (const row of accumulationRows) {
      const delta = row.reconciliationDelta ?? 0;
      expect(Math.abs(delta)).toBeLessThan(0.02);
    }

    expect(payload).toMatchSnapshot();
  });

  it("RSU scenario: vestValue in grossIncome, netProceeds to destination", () => {
    const { household, scenario } = getRsuScenario();
    const result = runProjection(household, scenario, HORIZON_YEARS);

    // RSU vests in year 2027 (START_YEAR + 2)
    const vestYear = 2027;
    const rowVest = result.yearRows.find((r) => r.year === vestYear);
    expect(rowVest).toBeDefined();
    expect(rowVest!.rsuVestValue).toBe(100 * 300); // 30_000
    expect(rowVest!.rsuWithholding).toBeCloseTo(30_000 * 0.22, -2); // 6_600
    expect(rowVest!.rsuNetProceeds).toBeCloseTo(30_000 * 0.78, -2); // 23_400
    expect(rowVest!.grossIncome).toBeGreaterThanOrEqual(200_000 + 30_000);

    const payload = buildSnapshotPayload("rsu", result, household);
    expect(payload).toMatchSnapshot();
  });

  it("employer match scenario: includeEmployerMatch=true includes employer contribs", () => {
    const { household, scenario } = getEmployerMatchScenario();
    const result = runProjection(household, scenario, HORIZON_YEARS);

    const y1 = result.yearRows[0];
    expect(y1!.employerContribs).toBe(7_500);
    expect(y1!.employeePreTaxContribs).toBe(15_000);
    expect(y1!.contributionsByAccount["trad"]).toBe(22_500); // 15k + 7.5k

    const payload = buildSnapshotPayload("employer-match", result, household);
    expect(payload).toMatchSnapshot();
  });
});
