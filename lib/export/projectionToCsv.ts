/**
 * Export projection data to CSV for download.
 * Columns: year, income, taxes, spending, per-account flows, net worth, invested.
 */

import type { ProjectionResult, YearRow } from "@/lib/model/engine";
import type { Account } from "@/lib/types/zod";

/** Escape a CSV field (wrap in quotes if it contains comma, newline, or quote). */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build header row for CSV.
 * Mirrors YearByYearTable structure: year, income, taxes, [withdrawal taxes], spending,
 * per-account contrib, [per-account withdrawal], per-account growth, per-account end,
 * net worth, invested.
 */
function buildHeaders(
  accounts: Account[],
  hasWithdrawalPhase: boolean
): string[] {
  const headers: string[] = [
    "Year",
    "Income",
    "Taxes",
  ];
  if (hasWithdrawalPhase) {
    headers.push("Withdrawal taxes");
  }
  headers.push("Spending");

  for (const a of accounts) {
    headers.push(`${escapeCsvField(a.name)} (contrib)`);
  }
  if (hasWithdrawalPhase) {
    for (const a of accounts) {
      headers.push(`${escapeCsvField(a.name)} (withdrawal)`);
    }
  }
  for (const a of accounts) {
    headers.push(`${escapeCsvField(a.name)} (growth)`);
  }
  for (const a of accounts) {
    headers.push(`${escapeCsvField(a.name)} (end)`);
  }
  headers.push("Unallocated surplus", "Net worth", "Invested");
  return headers;
}

/**
 * Convert a YearRow to CSV row cells.
 * Use raw numbers for spreadsheet compatibility.
 */
function rowToCells(
  row: YearRow,
  accounts: Account[],
  hasWithdrawalPhase: boolean
): (number | string)[] {
  const taxes = row.phase === "withdrawal" ? 0 : row.taxes;
  const cells: (number | string)[] = [
    row.year,
    row.grossIncome,
    taxes,
  ];
  if (hasWithdrawalPhase) {
    cells.push(row.withdrawalPhaseTaxes ?? 0);
  }
  cells.push(row.spending);

  for (const a of accounts) {
    cells.push(row.contributionsByAccount[a.id] ?? 0);
  }
  if (hasWithdrawalPhase) {
    for (const a of accounts) {
      cells.push(row.withdrawalByAccount?.[a.id] ?? 0);
    }
  }
  for (const a of accounts) {
    cells.push(row.growthByAccount[a.id] ?? 0);
  }
  for (const a of accounts) {
    cells.push(row.endingBalances[a.id] ?? 0);
  }
  cells.push(row.unallocatedSurplus ?? 0, row.netWorth, row.investedAssets);
  return cells;
}

/**
 * Serialize projection to CSV string.
 */
export function projectionToCsv(
  projection: ProjectionResult,
  accounts: Account[]
): string {
  const { yearRows } = projection;
  if (!yearRows.length) {
    return "Year,Income,Taxes,Spending,Net worth,Invested\n";
  }

  const hasWithdrawalPhase = yearRows.some(
    (r) =>
      r.phase === "withdrawal" ||
      (r.withdrawalByAccount &&
        Object.values(r.withdrawalByAccount).some((v) => v > 0))
  );

  const headers = buildHeaders(accounts, hasWithdrawalPhase);
  const rows: string[] = [headers.join(",")];

  for (const row of yearRows) {
    const cells = rowToCells(row, accounts, hasWithdrawalPhase).map((c) =>
      typeof c === "number" ? String(c) : escapeCsvField(c)
    );
    rows.push(cells.join(","));
  }

  return rows.join("\n");
}

/**
 * Trigger browser download of projection as CSV file.
 */
export function downloadProjectionCsv(
  projection: ProjectionResult,
  accounts: Account[],
  filename?: string
): void {
  const csv = projectionToCsv(projection, accounts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    filename ?? `financial-projection-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
