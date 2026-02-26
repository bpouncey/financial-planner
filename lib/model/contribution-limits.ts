/**
 * IRS annual contribution limits for tax-advantaged accounts.
 * Limits are indexed by year; uses nearest known year for out-of-range.
 * Sources: IRS.gov, cost-of-living adjustments.
 *
 * - 401k/403b: TRADITIONAL_401K + ROTH_401K + 403B share employee deferral limit per person (~$24.5k).
 * - IRA: TRADITIONAL_IRA + ROTH_IRA share combined limit per person (~$7.5k).
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

/** 401k/403b types that share the same employee deferral limit per person (IRS: combined across all plans). */
const TYPES_401K_AND_403B: AccountType[] = [
  "TRADITIONAL_401K",
  "ROTH_401K",
  "403B",
];

/** IRA types that share the same combined limit per person. */
const TYPES_IRA: AccountType[] = ["TRADITIONAL_IRA", "ROTH_IRA"];

/** HSA: limit is per person (self) or per family; aggregate across person's accounts. */
const TYPES_HSA: AccountType[] = ["HSA"];

function appliesInYear(c: Contribution, year: number): boolean {
  const start = c.startYear ?? -Infinity;
  const end = c.endYear ?? Infinity;
  return year >= start && year <= end;
}

/** Compute total contributions by account for a given year. */
export function getContributionsByAccount(
  household: Household,
  scenario: Scenario,
  year: number
): Record<string, number> {
  const startYear = household.startYear;
  const people = household.people;
  const inflation = scenario.inflation ?? 0.03;
  const salaryGrowthMode = scenario.salaryGrowthMode ?? "REAL";

  const getPersonGrossIncome = (person: Person, y: number): number => {
    const yearsFromStart = y - startYear;
    const salaryGrowth =
      scenario.salaryGrowthOverride ?? person.income.salaryGrowthRate ?? 0;
    const growthFactor =
      salaryGrowthMode === "REAL"
        ? Math.pow(1 + inflation, yearsFromStart)
        : Math.pow(1 + salaryGrowth, yearsFromStart);
    let income = person.income.baseSalaryAnnual * growthFactor;
    if (person.income.bonusAnnual) income += person.income.bonusAnnual;
    if (person.income.bonusPercent)
      income += person.income.baseSalaryAnnual * (person.income.bonusPercent / 100);
    return income;
  };

  const out: Record<string, number> = {};

  const includeEmployerMatch = scenario.includeEmployerMatch ?? false;
  for (const person of people) {
    for (const c of person.payroll.payrollInvesting ?? []) {
      if (!includeEmployerMatch && c.contributorType === "employer") continue;
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

/** Total contributions by person and bucket (401k/403b, IRA, HSA) for shared-limit checks. Limits are per person, not per account. */
export function getContributionsByPersonAndBucket(
  household: Household,
  contributionsByAccount: Record<string, number>
): Record<string, { "401k": number; ira: number; hsa: number }> {
  const people = household.people;
  const out: Record<string, { "401k": number; ira: number; hsa: number }> = {};
  for (const p of people) out[p.id] = { "401k": 0, ira: 0, hsa: 0 };

  for (const account of household.accounts) {
    const personId = getPersonIdForOwner(household, account.owner);
    if (!personId || !(personId in out)) continue;
    const amt = contributionsByAccount[account.id] ?? 0;
    if (TYPES_401K_AND_403B.includes(account.type)) out[personId]!["401k"] += amt;
    else if (TYPES_IRA.includes(account.type)) out[personId]!.ira += amt;
    else if (TYPES_HSA.includes(account.type)) out[personId]!.hsa += amt;
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
    if (!TYPES_401K_AND_403B.includes(account.type)) continue;
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
  const byPerson = getContributionsBreakdownByPersonAndAccount(
    household,
    scenario,
    year
  );
  const out: Record<string, { employee: number; employer: number }> = {};
  for (const [accountId, byP] of Object.entries(byPerson)) {
    let employee = 0;
    let employer = 0;
    for (const p of Object.values(byP)) {
      employee += p.employee;
      employer += p.employer;
    }
    out[accountId] = { employee, employer };
  }
  return out;
}

/** Per-person, per-account breakdown (for JOINT account capping). */
function getContributionsBreakdownByPersonAndAccount(
  household: Household,
  scenario: Scenario,
  year: number
): Record<string, Record<string, { employee: number; employer: number }>> {
  const startYear = household.startYear;
  const people = household.people;
  const inflation = scenario.inflation ?? 0.03;
  const salaryGrowthMode = scenario.salaryGrowthMode ?? "REAL";

  const getPersonGrossIncome = (person: Person, y: number): number => {
    const yearsFromStart = y - startYear;
    const salaryGrowth =
      scenario.salaryGrowthOverride ?? person.income.salaryGrowthRate ?? 0;
    const growthFactor =
      salaryGrowthMode === "REAL"
        ? Math.pow(1 + inflation, yearsFromStart)
        : Math.pow(1 + salaryGrowth, yearsFromStart);
    let income = person.income.baseSalaryAnnual * growthFactor;
    if (person.income.bonusAnnual) income += person.income.bonusAnnual;
    if (person.income.bonusPercent)
      income += person.income.baseSalaryAnnual * (person.income.bonusPercent / 100);
    return income;
  };

  const out: Record<string, Record<string, { employee: number; employer: number }>> = {};

  const includeEmployerMatch = scenario.includeEmployerMatch ?? false;
  for (const person of people) {
    for (const c of person.payroll.payrollInvesting ?? []) {
      if (!includeEmployerMatch && c.contributorType === "employer") continue;
      if (!appliesInYear(c, year)) continue;
      const months = getMonthsInYear(c, year);
      const amt =
        c.percentOfIncome != null
          ? getPersonGrossIncome(person, year) * (c.percentOfIncome / 100) * (months / 12)
          : getProratedAnnualContribution(c, year);
      if (!out[c.accountId]) out[c.accountId] = {};
      if (!out[c.accountId]![person.id])
        out[c.accountId]![person.id] = { employee: 0, employer: 0 };
      if (c.contributorType === "employer") {
        out[c.accountId]![person.id]!.employer += amt;
      } else {
        out[c.accountId]![person.id]!.employee += amt;
      }
    }
  }

  return out;
}

export interface ContributionLimitInfo {
  accountId: string;
  accountType: AccountType;
  contributed: number;
  limit: number;
  percentOfLimit: number;
  isOverLimit: boolean;
  /** Amount to display for limit comparison (person's total in bucket for shared-limit types). */
  displayContributed?: number;
}

/**
 * Cap contributions at IRS limits. Returns a new Record with contributions
 * scaled down when they exceed per-person, per-bucket limits (401k, IRA, HSA).
 * Used by the projection engine so displayed and modeled contributions are legal.
 */
export function capContributionsAtIRSLimits(
  household: Household,
  scenario: Scenario,
  year: number,
  rawContributions: Record<string, number>,
  breakdown: Record<string, { employee: number; employer: number }>
): Record<string, number> {
  const breakdownByPerson = getContributionsBreakdownByPersonAndAccount(
    household,
    scenario,
    year
  );
  const result = { ...rawContributions };
  const limits = getLimitsForYear(year);
  const employeeLimit = limits["401k"];
  const combinedLimit = limits["401kCombined"];
  const iraLimit = limits.ira;
  const hsaLimit = limits.hsa;

  for (const person of household.people) {
    const personId = person.id;

    // 401k/403b: cap employee deferral (shared across Trad+Roth+403b); combined limit (employee+employer) via effective cap
    const k401Accounts = household.accounts.filter(
      (a) =>
        TYPES_401K_AND_403B.includes(a.type as (typeof TYPES_401K_AND_403B)[number]) &&
        getPersonIdForOwner(household, a.owner) === personId
    );
    if (k401Accounts.length > 0) {
      let employeeTotal = 0;
      let employerTotal = 0;
      for (const a of k401Accounts) {
        const b = breakdown[a.id];
        employeeTotal += b?.employee ?? 0;
        employerTotal += b?.employer ?? 0;
      }
      const effectiveEmployeeCap = Math.max(
        0,
        Math.min(employeeLimit, combinedLimit - employerTotal)
      );
      if (employeeTotal > effectiveEmployeeCap && employeeTotal > 0) {
        const scale = effectiveEmployeeCap / employeeTotal;
        for (const a of k401Accounts) {
          const b = breakdown[a.id];
          const emp = b?.employee ?? 0;
          const empl = b?.employer ?? 0;
          result[a.id] = emp * scale + empl;
        }
      }
    }

    // IRA: cap total across Trad+Roth
    const iraAccounts = household.accounts.filter(
      (a) =>
        TYPES_IRA.includes(a.type as (typeof TYPES_IRA)[number]) &&
        getPersonIdForOwner(household, a.owner) === personId
    );
    if (iraAccounts.length > 0) {
      let iraTotal = 0;
      for (const a of iraAccounts) {
        iraTotal += result[a.id] ?? 0;
      }
      if (iraTotal > iraLimit && iraTotal > 0) {
        const scale = iraLimit / iraTotal;
        for (const a of iraAccounts) {
          result[a.id] = (result[a.id] ?? 0) * scale;
        }
      }
    }

    // HSA: cap total
    const hsaAccounts = household.accounts.filter(
      (a) =>
        TYPES_HSA.includes(a.type as (typeof TYPES_HSA)[number]) &&
        getPersonIdForOwner(household, a.owner) === personId
    );
    if (hsaAccounts.length > 0) {
      let hsaTotal = 0;
      for (const a of hsaAccounts) {
        hsaTotal += result[a.id] ?? 0;
      }
      if (hsaTotal > hsaLimit && hsaTotal > 0) {
        const scale = hsaLimit / hsaTotal;
        for (const a of hsaAccounts) {
          result[a.id] = (result[a.id] ?? 0) * scale;
        }
      }
    }
  }

  // JOINT 401k/403b: cap each person's contribution; account may have multiple people contributing
  const joint401kAccounts = household.accounts.filter(
    (a) =>
      TYPES_401K_AND_403B.includes(a.type as (typeof TYPES_401K_AND_403B)[number]) &&
      a.owner === "JOINT"
  );
  if (joint401kAccounts.length > 0) {
    for (const a of joint401kAccounts) {
      const byP = breakdownByPerson[a.id];
      if (!byP) continue;
      let cappedTotal = 0;
      for (const [pid, pBreakdown] of Object.entries(byP)) {
        const emp = pBreakdown.employee;
        const empl = pBreakdown.employer;
        const effectiveCap = Math.max(
          0,
          Math.min(employeeLimit, combinedLimit - empl)
        );
        const cappedEmp = emp > effectiveCap && emp > 0 ? effectiveCap : emp;
        cappedTotal += cappedEmp + empl;
      }
      result[a.id] = cappedTotal;
    }
  }

  return result;
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
  const isHsa = accountType === "HSA";

  const effectiveContributed =
    totalContributedInBucket != null && (is401k || isIra || isHsa)
      ? totalContributedInBucket
      : contributed;

  if (is401k) {
    const employeeContributed =
      totalEmployeeIn401kBucket ?? breakdown?.employee ?? contributed;
    const isOverLimit = employeeContributed > limit;
    return {
      accountId,
      accountType,
      contributed,
      limit,
      percentOfLimit: limit > 0 ? (employeeContributed / limit) * 100 : 0,
      isOverLimit,
      displayContributed: employeeContributed,
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
    displayContributed: effectiveContributed,
  };
}
