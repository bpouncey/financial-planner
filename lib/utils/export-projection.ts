/**
 * Export projection data as CSV for download.
 * Plan Phase 7.3: year, income, taxes, spending, per-account flows, net worth, invested.
 */

import type { ProjectionResult } from "@/lib/model/engine";
import type { Household } from "@/lib/types/zod";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvNumber(n: number): string {
  return Math.round(n).toString();
}

/** Build CSV string from projection. */
export function projectionToCsv(
  projection: ProjectionResult,
  household: Household
): string {
  const { yearRows } = projection;
  const accounts = household.accounts;
  const hasWithdrawalPhase = yearRows.some(
    (r) =>
      r.phase === "withdrawal" ||
      (r.withdrawalByAccount &&
        Object.values(r.withdrawalByAccount).some((v) => v > 0))
  );

  const headers: string[] = ["Year", "Income", "Taxes"];
  if (hasWithdrawalPhase) {
    headers.push("Withdrawal taxes");
  }
  headers.push("Spending");
  accounts.forEach((a) => headers.push(`${a.name} (contrib)`));
  if (hasWithdrawalPhase) {
    accounts.forEach((a) => headers.push(`${a.name} (withdrawal)`));
  }
  accounts.forEach((a) => headers.push(`${a.name} (growth)`));
  accounts.forEach((a) => headers.push(`${a.name} (end)`));
  headers.push("Net worth", "Invested");

  const rows: string[][] = [headers.map(escapeCsv)];

  for (const row of yearRows) {
    const cells: string[] = [
      formatCsvNumber(row.year),
      formatCsvNumber(row.grossIncome),
      formatCsvNumber(row.phase === "withdrawal" ? 0 : row.taxes),
    ];
    if (hasWithdrawalPhase) {
      cells.push(formatCsvNumber(row.withdrawalPhaseTaxes ?? 0));
    }
    cells.push(formatCsvNumber(row.spending));
    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.contributionsByAccount[a.id] ?? 0))
    );
    if (hasWithdrawalPhase) {
      accounts.forEach((a) =>
        cells.push(formatCsvNumber(row.withdrawalByAccount?.[a.id] ?? 0))
      );
    }
    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.growthByAccount[a.id] ?? 0))
    );
    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.endingBalances[a.id] ?? 0))
    );
    cells.push(formatCsvNumber(row.netWorth), formatCsvNumber(row.investedAssets));
    rows.push(cells);
  }

  return rows.map((r) => r.join(",")).join("\n");
}

/** Trigger browser download of projection as CSV. */
export function downloadProjectionCsv(
  projection: ProjectionResult,
  household: Household,
  options?: { scenarioName?: string; filename?: string }
): void {
  const csv = projectionToCsv(projection, household);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const scenarioName = options?.scenarioName ?? "projection";
  a.download =
    options?.filename ??
    `financial-projection-${scenarioName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
