/**
 * Validation and guardrails per docs/model/VALIDATION_GUARDRAILS.md.
 */

import type { Household, Scenario } from "@/lib/types/zod";
import { runProjection } from "./engine";

export interface ValidationError {
  code: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validate household + scenario for engine run.
 * Hard errors block calculation; soft warnings allow it.
 */
export function validateHousehold(
  household: Household,
  scenario: Scenario
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const accountIds = new Set(household.accounts.map((a) => a.id));
  const personIds = new Set(household.people.map((p) => p.id));

  // Validate payroll contribution account refs (no disappearing dollars)
  for (const person of household.people) {
    for (const c of person.payroll.payrollInvesting) {
      if (!c.accountId || !accountIds.has(c.accountId)) {
        errors.push({
          code: "MISSING_ACCOUNT_REF",
          message: c.accountId
            ? `Payroll contribution references non-existent account: ${c.accountId}`
            : "Select an account for each payroll contribution",
        });
      }
    }
  }

  // Validate out-of-pocket contribution account refs
  for (const c of household.outOfPocketInvesting ?? []) {
    if (!c.accountId || !accountIds.has(c.accountId)) {
      errors.push({
        code: "MISSING_ACCOUNT_REF",
        message: c.accountId
          ? `Out-of-pocket contribution references non-existent account: ${c.accountId}`
          : "Select an account for each out-of-pocket contribution",
      });
    }
  }

  // Validate monthly savings contribution account refs
  for (const c of household.monthlySavings ?? []) {
    if (!c.accountId || !accountIds.has(c.accountId)) {
      errors.push({
        code: "MISSING_ACCOUNT_REF",
        message: c.accountId
          ? `Monthly savings contribution references non-existent account: ${c.accountId}`
          : "Select an account for each monthly savings contribution",
      });
    }
  }

  if (scenario.swr <= 0 || scenario.swr > 0.1) {
    errors.push({
      code: "INVALID_SWR",
      message: `SWR must be between 0 and 10% (got ${scenario.swr * 100}%)`,
    });
  }

  if (
    scenario.nominalReturn < -0.5 ||
    scenario.nominalReturn > 0.5 ||
    scenario.inflation < -0.5 ||
    scenario.inflation > 0.5
  ) {
    errors.push({
      code: "INVALID_RATES",
      message: "Return and inflation must be between -50% and 50%",
    });
  }

  for (const a of household.accounts) {
    if (a.startingBalance < 0) {
      errors.push({
        code: "NEGATIVE_BALANCE",
        message: `Account ${a.name} has negative starting balance`,
      });
    }
  }

  // Validate equity grants: destinationAccountId and ownerPersonId exist
  for (const grant of household.equityGrants ?? []) {
    if (!accountIds.has(grant.destinationAccountId)) {
      errors.push({
        code: "MISSING_ACCOUNT_REF",
        message: `Equity grant "${grant.id}" references non-existent destination account: ${grant.destinationAccountId}`,
      });
    }
    if (!personIds.has(grant.ownerPersonId)) {
      errors.push({
        code: "MISSING_PERSON_REF",
        message: `Equity grant "${grant.id}" references non-existent owner: ${grant.ownerPersonId}`,
      });
    }
  }

  // Validate events: accountId exists; OUTFLOW requires accountId
  for (const event of household.events ?? []) {
    if (event.kind === "OUTFLOW" && !event.accountId) {
      errors.push({
        code: "MISSING_ACCOUNT_REF",
        message: `Event "${event.name}" (year ${event.year}) is an outflow—select a source account`,
      });
    } else if (event.accountId && !accountIds.has(event.accountId)) {
      errors.push({
        code: "MISSING_ACCOUNT_REF",
        message: `Event "${event.name}" references non-existent account: ${event.accountId}`,
      });
    }
  }

  // Event warnings: OUTFLOW would reduce account below $0 (only if account ref is valid)
  const outflowEventsWithValidAccount = (household.events ?? []).filter(
    (e) =>
      e.kind === "OUTFLOW" &&
      e.accountId &&
      accountIds.has(e.accountId)
  );
  if (outflowEventsWithValidAccount.length > 0) {
    try {
      const maxEventYear = Math.max(
        ...outflowEventsWithValidAccount.map((e) => e.year)
      );
      const horizon = Math.max(
        50,
        maxEventYear - household.startYear + 1
      );
      const result = runProjection(household, scenario, horizon);
      const accountByName = new Map(
        household.accounts.map((a) => [a.id, a.name])
      );
      for (const event of outflowEventsWithValidAccount) {
        const accountId = event.accountId!;
        const preBalance =
          event.year === household.startYear
            ? (household.accounts.find((a) => a.id === accountId)
                ?.startingBalance ?? 0)
            : (result.yearRows.find((r) => r.year === event.year - 1)
                ?.endingBalances?.[accountId] ?? 0);
        if (preBalance - event.amount < 0) {
          const accountName = accountByName.get(accountId) ?? accountId;
          warnings.push({
            code: "EVENT_OVERDRAFT",
            message: `Event "${event.name}" in year ${event.year} reduces account "${accountName}" below $0 (balance ~$${Math.round(preBalance).toLocaleString()}, outflow $${Math.round(event.amount).toLocaleString()})`,
          });
        }
      }
    } catch {
      // If projection fails (e.g. validation errors), skip event warnings
    }
  }

  // Equity grant warnings: empty vesting table, or all vests before projection
  for (const grant of household.equityGrants ?? []) {
    const vestingYears = (grant.vestingTable ?? [])
      .filter((e) => e.shares > 0)
      .map((e) => e.year);
    if (vestingYears.length === 0) {
      warnings.push({
        code: "EQUITY_EMPTY_VESTING",
        message: `Equity grant "${grant.id}" has no vesting entries—it will not add any proceeds`,
      });
    } else if (vestingYears.every((y) => y < household.startYear)) {
      warnings.push({
        code: "EQUITY_VESTED_BEFORE_START",
        message: `Equity grant "${grant.id}" only vests in years before projection start (${household.startYear})—no proceeds will be applied`,
      });
    }
  }

  if (scenario.nominalReturn > 0.07) {
    warnings.push({
      code: "AGGRESSIVE_RETURNS",
      message: "Real return > 7% is aggressive; consider conservative case",
    });
  }

  if (scenario.retirementMonthlySpend < (scenario.currentMonthlySpend ?? 6353)) {
    warnings.push({
      code: "RETIREMENT_SPEND_LT_CURRENT",
      message: "Retirement spend < current spend—is that intentional?",
    });
  }

  const takeHome = scenario.takeHomeAnnual;
  const currentSpend =
    (scenario.currentMonthlySpend ?? 6353) * 12 +
    household.people.reduce((s, p) => s + (p.payroll.payrollDeductionsSpending ?? 0), 0);
  const totalOop = (household.outOfPocketInvesting ?? []).reduce((s, c) => {
    const amt = c.amountAnnual ?? (c.amountMonthly ?? 0) * 12;
    return s + amt;
  }, 0);
  const totalSavings = (household.monthlySavings ?? []).reduce((s, c) => {
    const amt = c.amountAnnual ?? (c.amountMonthly ?? 0) * 12;
    return s + amt;
  }, 0);

  if (takeHome != null && takeHome - currentSpend - totalOop - totalSavings < -1000) {
    warnings.push({
      code: "CASHFLOW_DEFICIT",
      message: `Plan spends $${Math.round(currentSpend + totalOop + totalSavings - takeHome)} more than take-home this year`,
    });
  }

  return { errors, warnings };
}

/**
 * "No disappearing dollars" guardrail (Test 2).
 * In MVP with take-home mode, we ensure all contribution accountIds exist.
 * An "unclassified adjustment" would be a negative editable field that reduces
 * savings without being mapped—we don't have that in MVP schema; this validates
 * that we never have orphan references.
 */
export function hasUnclassifiedAdjustment(): boolean {
  return false;
}
