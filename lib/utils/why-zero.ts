/**
 * Helpers to derive "why" a zero-value cell appears in the year-by-year table.
 * Used for tooltips when contribution is $0 due to phase or contribution date range.
 */

import type { Household, Contribution } from "@/lib/types/zod";

/** Collect all contributions that target a given account (payroll + out-of-pocket). */
export function getContributionsForAccount(
  household: Household,
  accountId: string
): Contribution[] {
  const contributions: Contribution[] = [];
  for (const person of household.people) {
    for (const c of person.payroll?.payrollInvesting ?? []) {
      if (c.accountId === accountId) contributions.push(c);
    }
  }
  for (const c of household.outOfPocketInvesting ?? []) {
    if (c.accountId === accountId) contributions.push(c);
  }
  for (const c of household.monthlySavings ?? []) {
    if (c.accountId === accountId) contributions.push(c);
  }
  return contributions;
}

/** Check if a contribution applies in a given year (startYear/endYear inclusive). */
export function contributionAppliesInYear(
  c: Contribution,
  year: number
): boolean {
  const start = c.startYear ?? -Infinity;
  const end = c.endYear ?? Infinity;
  return year >= start && year <= end;
}

/**
 * Get explanation for why a contribution cell is $0.
 * Returns null if no special reason (e.g. no contributions configured, or engine produced 0 for other reasons).
 */
export function getWhyZeroContribution(
  household: Household,
  accountId: string,
  year: number,
  phase: "accumulation" | "withdrawal"
): string | null {
  if (phase === "withdrawal") {
    return "Retirement: no contributions";
  }

  const contributions = getContributionsForAccount(household, accountId);
  if (contributions.length === 0) {
    return null;
  }

  const anyApplies = contributions.some((c) => contributionAppliesInYear(c, year));
  if (anyApplies) {
    return null;
  }

  const allEndedBefore = contributions.every((c) => {
    const end = c.endYear ?? Infinity;
    return end < year;
  });
  if (allEndedBefore) {
    const endedYears = contributions
      .filter((c) => c.endYear != null && c.endYear < year)
      .map((c) => c.endYear!);
    if (endedYears.length > 0) {
      return `Contribution ended (endYear ${Math.max(...endedYears)})`;
    }
  }

  const allStartAfter = contributions.every((c) => {
    const start = c.startYear ?? -Infinity;
    return start > year;
  });
  if (allStartAfter) {
    const startYears = contributions
      .filter((c) => c.startYear != null && c.startYear > year)
      .map((c) => c.startYear!);
    if (startYears.length > 0) {
      return `Contribution starts (startYear ${Math.min(...startYears)})`;
    }
  }

  return null;
}
