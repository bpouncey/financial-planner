/**
 * IRS annual contribution limits for tax-advantaged accounts.
 * Limits are indexed by year; uses nearest known year for out-of-range.
 * Sources: IRS.gov, cost-of-living adjustments.
 *
 * - 401k: TRADITIONAL_401K + ROTH_401K share employee deferral limit (~$23.5k).
 * - IRA: TRADITIONAL_IRA + ROTH_IRA share combined limit (~$7k).
 * - 403B: separate limit (similar to 401k).
 * - HSA: family limit (higher).
 */

import type { Household, Scenario, Contribution, Person } from "@/lib/types/zod";
import type { AccountType } from "@/lib/types/zod";
import {
  getMonthsInYear,
  getProratedAnnualContribution,
} from "@/lib/model/engine";

/** IRS limits by year. 401k: employee deferral limit; 401kCombined: employee+employer. IRA, HSA family. */
const LIMITS_BY_YEAR: Record<
  number,
  { "401k": number; "401kCombined": number; ira: number; hsa: number }
> = {
  2024: { "401k": 23000, "401kCombined": 69000, ira: 7000, hsa: 8300 },
  2025: { "401k": 23500, "401kCombined": 70000, ira: 7000, hsa: 8550 },
  2026: { "401k": 24500, "401kCombined": 72000, ira: 7500, hsa: 8750 },
  2027: { "401k": 24500, "401kCombined": 72000, ira: 7500, hsa: 8750 }, // placeholder
};

const KNOWN_YEARS = Object.keys(LIMITS_BY_YEAR).map(Number);
const MIN_YEAR = Math.min(...KNOWN_YEARS);
const MAX_YEAR = Math.max(...KNOWN_YEARS);

function getLimitsForYear(year: number) {
  if (year in LIMITS_BY_YEAR) return LIMITS_BY_YEAR[year]!;
  if (year < MIN_YEAR) return LIMITS_BY_YEAR[MIN_YEAR]!;
  return LIMITS_BY_YEAR[MAX_YEAR]!;
}

/** Get legal annual employee contribution limit for an account type, or null if no limit. */
export function getContributionLimit(
  accountType: AccountType,
  year: number
): number | null {
  const limits = getLimitsForYear(year);
  switch (accountType) {
    case "TRADITIONAL_401K":
    case "ROTH_401K":
    case "403B":
      return limits["401k"];
    case "TRADITIONAL_IRA":
    case "ROTH_IRA":
      return limits.ira;
    case "HSA":
      return limits.hsa;
    default:
      return null;
  }
}

/** Get combined (employee + employer) limit for 401k/403b. Null for other types. */
export function get401kCombinedLimit(accountType: AccountType, year: number): number | null {
  if (accountType !== "TRADITIONAL_401K" && accountType !== "ROTH_401K" && accountType !== "403B")
    return null;
  return getLimitsForYear(year)["401kCombined"];
}

/** Account types that have legal contribution limits. */
export const LIMITED_ACCOUNT_TYPES: AccountType[] = [
  "TRADITIONAL_401K",
  "ROTH_401K",
  "TRADITIONAL_IRA",
  "ROTH_IRA",
  "403B",
  "HSA",
];

/** 401k types that share the same employee deferral limit per person. */
const TYPES_401K: AccountType[] = ["TRADITIONAL_401K", "ROTH_401K"];

/** IRA types that share the same combined limit per person. */
const TYPES_IRA: AccountType[] = ["TRADITIONAL_IRA", "ROTH_IRA"];

function appliesInYear(c: Contribution, year: number): boolean {
  const start = c.startYear ?? -Infinity;
  const end = c.endYear ?? Infinity;
  return year >= start && year <= end;
}

/** Real growth factor for salary (nominal growth adjusted for inflation). */
function growthFactorReal(nominalGrowth: number, inflation: number): number {
  return (1 + nominalGrowth) / (1 + inflation) - 1;
}

/** Compute total contributions by account for a given year. */
export function getContributionsByAccount(
  household: Household,
  scenario: Scenario,
  year: number
): Record<string, number> {
  const startYear = household.startYear;
  const people = household.people;
  const isReal = scenario.modelingMode === "REAL";
  const inflation = scenario.inflation ?? 0.03;

  const getPersonGrossIncome = (person: Person, y: number): number => {
    const yearsFromStart = y - startYear;
    const salaryGrowth =
      scenario.salaryGrowthOverride ?? person.income.salaryGrowthRate ?? 0;
    const growthFactor =
      person.income.salaryGrowthIsReal && isReal
        ? Math.pow(
            1 + growthFactorReal(salaryGrowth, inflation),
            yearsFromStart
          )
        : Math.pow(1 + salaryGrowth, yearsFromStart);
    let income = person.income.baseSalaryAnnual * growthFactor;
    if (person.income.bonusAnnual) income += person.income.bonusAnnual;
    if (person.income.bonusPercent)
      income += person.income.baseSalaryAnnual * (person.income.bonusPercent / 100);
    return income;
  };

  const out: Record<string, number> = {};

  for (const person of people) {
    for (const c of person.payroll.payrollInvesting ?? []) {
      if (!appliesInYear(c, year)) continue;
      const months = getMonthsInYear(c, year);
      const amt =
        c.percentOfIncome != null
          ? getPersonGrossIncome(person, year) * (c.percentOfIncome / 100) * (months / 12)
          : getProratedAnnualContribution(c, year);
      out[c.accountId] = (out[c.accountId] ?? 0) + amt;
    }
  }

  for (const c of household.outOfPocketInvesting ?? []) {
    if (!appliesInYear(c, year)) continue;
    const amt = getProratedAnnualContribution(c, year);
    out[c.accountId] = (out[c.accountId] ?? 0) + amt;
  }

  for (const c of household.monthlySavings ?? []) {
    if (!appliesInYear(c, year)) continue;
    const amt = getProratedAnnualContribution(c, year);
    out[c.accountId] = (out[c.accountId] ?? 0) + amt;
  }

  return out;
}

/** Map account owner to person id (PERSON_A = people[0], PERSON_B = people[1]). JOINT returns null. */
function getPersonIdForOwner(household: Household, owner: string): string | null {
  if (owner === "PERSON_A") return household.people[0]?.id ?? null;
  if (owner === "PERSON_B") return household.people[1]?.id ?? null;
  return null;
}

/** Total contributions by person and bucket (401k vs IRA) for shared-limit checks. */
export function getContributionsByPersonAndBucket(
  household: Household,
  contributionsByAccount: Record<string, number>
): Record<string, { "401k": number; "ira": number }> {
  const people = household.people;
  const out: Record<string, { "401k": number; "ira": number }> = {};
  for (const p of people) out[p.id] = { "401k": 0, "ira": 0 };

  for (const account of household.accounts) {
    const personId = getPersonIdForOwner(household, account.owner);
    if (!personId || !(personId in out)) continue;
    const amt = contributionsByAccount[account.id] ?? 0;
    if (TYPES_401K.includes(account.type)) out[personId]!["401k"] += amt;
    else if (TYPES_IRA.includes(account.type)) out[personId]!["ira"] += amt;
  }
  return out;
}

/** Employee+employer breakdown by person and 401k bucket (for dual-limit display). */
export function getContributionsBreakdownByPersonAndBucket(
  household: Household,
  breakdownByAccount: Record<string, { employee: number; employer: number }>
): Record<string, { employee: number; employer: number }> {
  const people = household.people;
  const out: Record<string, { employee: number; employer: number }> = {};
  for (const p of people) out[p.id] = { employee: 0, employer: 0 };

  for (const account of household.accounts) {
    if (!TYPES_401K.includes(account.type) && account.type !== "403B") continue;
    const personId = getPersonIdForOwner(household, account.owner);
    if (!personId || !(personId in out)) continue;
    const b = breakdownByAccount[account.id];
    if (b) {
      out[personId]!.employee += b.employee;
      out[personId]!.employer += b.employer;
    }
  }
  return out;
}

/** Employee vs employer breakdown for payroll contributions (401k/403b limit checks). */
export function getContributionsBreakdown(
  household: Household,
  scenario: Scenario,
  year: number
): Record<string, { employee: number; employer: number }> {
  const startYear = household.startYear;
  const people = household.people;
  const isReal = scenario.modelingMode === "REAL";
  const inflation = scenario.inflation ?? 0.03;

  const getPersonGrossIncome = (person: Person, y: number): number => {
    const yearsFromStart = y - startYear;
    const salaryGrowth =
      scenario.salaryGrowthOverride ?? person.income.salaryGrowthRate ?? 0;
    const growthFactor =
      person.income.salaryGrowthIsReal && isReal
        ? Math.pow(
            1 + growthFactorReal(salaryGrowth, inflation),
            yearsFromStart
          )
        : Math.pow(1 + salaryGrowth, yearsFromStart);
    let income = person.income.baseSalaryAnnual * growthFactor;
    if (person.income.bonusAnnual) income += person.income.bonusAnnual;
    if (person.income.bonusPercent)
      income += person.income.baseSalaryAnnual * (person.income.bonusPercent / 100);
    return income;
  };

  const breakdown: Record<string, { employee: number; employer: number }> = {};

  for (const person of people) {
    for (const c of person.payroll.payrollInvesting ?? []) {
      if (!appliesInYear(c, year)) continue;
      const months = getMonthsInYear(c, year);
      const amt =
        c.percentOfIncome != null
          ? getPersonGrossIncome(person, year) * (c.percentOfIncome / 100) * (months / 12)
          : getProratedAnnualContribution(c, year);
      if (!breakdown[c.accountId]) breakdown[c.accountId] = { employee: 0, employer: 0 };
      if (c.contributorType === "employer") {
        breakdown[c.accountId]!.employer += amt;
      } else {
        breakdown[c.accountId]!.employee += amt;
      }
    }
  }

  return breakdown;
}

export interface ContributionLimitInfo {
  accountId: string;
  accountType: AccountType;
  contributed: number;
  limit: number;
  percentOfLimit: number;
  isOverLimit: boolean;
  /** For 401k/403b when breakdown provided: employee limit and combined limit. */
  employeeLimit?: number;
  employeeContributed?: number;
  combinedLimit?: number;
  employerContributed?: number;
  isOverEmployeeLimit?: boolean;
  isOverCombinedLimit?: boolean;
}

/** Get contribution vs limit info for an account. */
export function getContributionLimitInfo(
  accountId: string,
  accountType: AccountType,
  contributed: number,
  year: number,
  breakdown?: { employee: number; employer: number },
  /** For 401k/IRA types: total contributed in that bucket for this person (shared limit). */
  totalContributedInBucket?: number,
  /** For 401k: total employee deferral in 401k bucket (Trad+Roth share limit). */
  totalEmployeeIn401kBucket?: number
): ContributionLimitInfo | null {
  const limit = getContributionLimit(accountType, year);
  if (limit == null) return null;

  const is401k =
    accountType === "TRADITIONAL_401K" ||
    accountType === "ROTH_401K" ||
    accountType === "403B";
  const isIra = accountType === "TRADITIONAL_IRA" || accountType === "ROTH_IRA";
  const combinedLimit = is401k ? get401kCombinedLimit(accountType, year) : null;

  const effectiveContributed =
    totalContributedInBucket != null && (is401k || isIra)
      ? totalContributedInBucket
      : contributed;

  if (is401k && combinedLimit != null) {
    const employeeContributed =
      totalEmployeeIn401kBucket ?? breakdown?.employee ?? contributed;
    const employerContributed = breakdown?.employer ?? 0;
    const totalForCombined = totalContributedInBucket ?? contributed;
    const isOverEmployeeLimit = employeeContributed > limit;
    const isOverCombinedLimit = totalForCombined > combinedLimit;
    return {
      accountId,
      accountType,
      contributed,
      limit,
      percentOfLimit: limit > 0 ? (employeeContributed / limit) * 100 : 0,
      isOverLimit: isOverEmployeeLimit || isOverCombinedLimit,
      employeeLimit: limit,
      employeeContributed,
      combinedLimit,
      employerContributed,
      isOverEmployeeLimit,
      isOverCombinedLimit,
    };
  }

  const percentOfLimit =
    limit > 0 ? (effectiveContributed / limit) * 100 : 0;
  return {
    accountId,
    accountType,
    contributed,
    limit,
    percentOfLimit,
    isOverLimit: effectiveContributed > limit,
  };
}
