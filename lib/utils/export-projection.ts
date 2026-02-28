/**
 * Export projection data as CSV for download.
 * Per accuracy-data-contract: all required fields + validation (errors, warnings, assumptions).
 */

import type { ProjectionResult, YearRow } from "@/lib/model/engine";
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

/** Compute portfolioStart for a row (start-of-year portfolio value). */
function getPortfolioStart(
  row: YearRow,
  rowIndex: number,
  yearRows: YearRow[],
  household: Household
): number {
  if (rowIndex === 0) {
    return household.accounts.reduce(
      (sum, a) => sum + (a.startingBalance ?? 0),
      0
    );
  }
  const prev = yearRows[rowIndex - 1];
  return prev?.netWorth ?? 0;
}

/** Compute contribAfterTax: out-of-pocket + monthly savings (excludes payroll and RSU). */
function getContribAfterTax(row: YearRow): number {
  const totalContrib = Object.values(row.contributionsByAccount ?? {}).reduce(
    (s, v) => s + v,
    0
  );
  const payroll =
    (row.employeePreTaxContribs ?? 0) +
    (row.employeeRothContribs ?? 0) +
    (row.employerContribs ?? 0);
  const rsu = row.rsuNetProceeds ?? 0;
  return Math.max(0, totalContrib - payroll - rsu);
}

/** Build CSV string from projection with full data-contract columns. */
export function projectionToCsv(
  projection: ProjectionResult,
  household: Household
): string {
  const { yearRows, validation } = projection;
  const accounts = household.accounts;

  // Data-contract headers per accuracy-data-contract.md
  const headers: string[] = [
    "Year",
    "Phase",
    "grossIncome",
    "taxesPayroll",
    "taxesAdditional",
    "netToChecking",
    "spending",
    "contribEmployeePreTax",
    "contribEmployeeRoth",
    "contribEmployer",
    "contribAfterTax",
    "rsuVestValue",
    "rsuWithholding",
    "rsuNetProceeds",
    "taxesFromSalary",
    "taxesFromRSU",
    "withdrawalsTraditional",
    "withdrawalsRoth",
    "withdrawalsTaxable",
    "withdrawalTaxes",
    "withdrawalsTraditionalGross",
    "withdrawalTaxesPaid",
    "unallocatedSurplus",
    "bucketUsedTaxable",
    "bucketUsedTaxDeferred",
    "bucketUsedRoth",
    "portfolioStart",
    "portfolioGrowth",
    "portfolioEnd",
    "reconciliationDelta",
  ];

  // Per-account columns (contrib, withdrawal, growth, end) for compatibility
  accounts.forEach((a) => headers.push(`${escapeCsv(a.name)} (contrib)`));
  accounts.forEach((a) => headers.push(`${escapeCsv(a.name)} (withdrawal)`));
  accounts.forEach((a) => headers.push(`${escapeCsv(a.name)} (growth)`));
  accounts.forEach((a) => headers.push(`${escapeCsv(a.name)} (end)`));
  headers.push("netWorth", "investedAssets");

  const rows: string[][] = [headers];

  for (let i = 0; i < yearRows.length; i++) {
    const row = yearRows[i]!;
    const portfolioStart = getPortfolioStart(row, i, yearRows, household);
    const portfolioGrowth = Object.values(row.growthByAccount ?? {}).reduce(
      (s, v) => s + v,
      0
    );
    const portfolioEnd = row.netWorth;
    const contribAfterTax = getContribAfterTax(row);

    const cells: string[] = [
      formatCsvNumber(row.year),
      row.phase ?? "accumulation",
      formatCsvNumber(row.grossIncome),
      formatCsvNumber(row.taxesPayroll ?? (row.phase === "withdrawal" ? 0 : row.taxes)),
      formatCsvNumber(row.taxesAdditional ?? 0),
      formatCsvNumber(row.netToChecking ?? 0),
      formatCsvNumber(row.spending),
      formatCsvNumber(row.employeePreTaxContribs ?? 0),
      formatCsvNumber(row.employeeRothContribs ?? 0),
      formatCsvNumber(row.employerContribs ?? 0),
      formatCsvNumber(contribAfterTax),
      formatCsvNumber(row.rsuVestValue ?? 0),
      formatCsvNumber(row.rsuWithholding ?? 0),
      formatCsvNumber(row.rsuNetProceeds ?? 0),
      formatCsvNumber(row.taxesFromSalary ?? 0),
      formatCsvNumber(row.taxesFromRSU ?? 0),
      formatCsvNumber(row.withdrawalsTraditional ?? 0),
      formatCsvNumber(row.withdrawalsRoth ?? 0),
      formatCsvNumber(row.withdrawalsTaxable ?? 0),
      formatCsvNumber(row.withdrawalTaxes ?? 0),
      formatCsvNumber(row.withdrawalsTraditional ?? 0), // gross when gross-up implemented
      formatCsvNumber(row.withdrawalTaxes ?? 0),
      formatCsvNumber(row.unallocatedSurplus ?? 0),
      (row.withdrawalsTaxable ?? 0) > 0 ? "1" : "0",
      (row.withdrawalsTraditional ?? 0) > 0 ? "1" : "0",
      (row.withdrawalsRoth ?? 0) > 0 ? "1" : "0",
      formatCsvNumber(portfolioStart),
      formatCsvNumber(portfolioGrowth),
      formatCsvNumber(portfolioEnd),
      formatCsvNumber(row.reconciliationDelta ?? 0),
    ];

    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.contributionsByAccount?.[a.id] ?? 0))
    );
    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.withdrawalByAccount?.[a.id] ?? 0))
    );
    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.growthByAccount?.[a.id] ?? 0))
    );
    accounts.forEach((a) =>
      cells.push(formatCsvNumber(row.endingBalances?.[a.id] ?? 0))
    );
    cells.push(formatCsvNumber(row.netWorth), formatCsvNumber(row.investedAssets));

    rows.push(cells);
  }

  let csv = rows.map((r) => r.join(",")).join("\n");

  // Append validation section (errors, warnings, assumptions)
  const hasValidation =
    validation.errors.length > 0 ||
    validation.warnings.length > 0 ||
    validation.assumptions.length > 0;

  if (hasValidation) {
    csv += "\n\n";
    csv += "--- Validation ---\n";
    if (validation.errors.length > 0) {
      csv += "Errors:\n";
      for (const e of validation.errors) {
        csv += `  ${e.code}: ${e.message.replace(/\n/g, " ")}\n`;
      }
    }
    if (validation.warnings.length > 0) {
      csv += "Warnings:\n";
      for (const w of validation.warnings) {
        csv += `  ${w.code}: ${w.message.replace(/\n/g, " ")}\n`;
      }
    }
    if (validation.assumptions.length > 0) {
      csv += "Assumptions:\n";
      for (const a of validation.assumptions) {
        csv += `  ${a.code}: ${a.message.replace(/\n/g, " ")}\n`;
      }
    }
  }

  return csv;
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
