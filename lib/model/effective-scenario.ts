/**
 * Resolve scenario optional fields to their effective values (engine defaults).
 * Used for export so third-party validators see exactly what the engine used.
 */

import type { Household, Scenario } from "@/lib/types/zod";
import { DEFAULT_TAXABLE_WITHDRAWAL_TAX_RATE } from "@/lib/model/constants";

const DEFAULT_WITHDRAWAL_BUCKETS = ["TAXABLE", "TAX_DEFERRED", "ROTH"] as const;
const DEFAULT_CURRENT_MONTHLY_SPEND = 6353;

/** Effective scenario: all optional fields resolved to engine defaults. */
export type EffectiveScenario = Scenario & {
  contributionOverrides: NonNullable<Scenario["contributionOverrides"]>;
  eventOverrides: NonNullable<Scenario["eventOverrides"]>;
  salaryGrowthMode: NonNullable<Scenario["salaryGrowthMode"]>;
  includeEmployerMatch: NonNullable<Scenario["includeEmployerMatch"]>;
  takeHomeDefinition: NonNullable<Scenario["takeHomeDefinition"]>;
  currentMonthlySpend: number;
  withdrawalOrderBuckets: NonNullable<Scenario["withdrawalOrderBuckets"]>;
  retireWhen: NonNullable<Scenario["retireWhen"]>;
  traditionalWithdrawalsTaxRate: number;
  rothWithdrawalsTaxRate: number;
  taxableWithdrawalsTaxRate: number;
  autoFixOverflow: boolean;
  enableUnallocatedSurplusBalancing: boolean;
  unallocatedSurplusFrequency: NonNullable<Scenario["unallocatedSurplusFrequency"]>;
};

/**
 * Resolve scenario to effective values used by the engine.
 * Ensures export matches what runProjection actually uses.
 */
export function getEffectiveScenarioForExport(
  household: Household,
  scenario: Scenario
): EffectiveScenario {
  const firstPerson = household.people[0];
  const startYear = household.startYear;
  const retireWhen = scenario.retireWhen ?? "EITHER";
  const computedRetirementStartYear =
    firstPerson?.birthYear != null
      ? firstPerson.birthYear + scenario.retirementAgeTarget
      : startYear + 30;
  const effectiveRetirementStartYear =
    scenario.retirementStartYear ??
    (retireWhen === "AGE" ? computedRetirementStartYear : null);

  const traditionalWithdrawalsTaxRate =
    scenario.traditionalWithdrawalsTaxRate ??
    scenario.retirementEffectiveTaxRate ??
    0;

  return {
    ...scenario,
    contributionOverrides: scenario.contributionOverrides ?? [],
    eventOverrides: scenario.eventOverrides ?? [],
    salaryGrowthMode: scenario.salaryGrowthMode ?? "REAL",
    includeEmployerMatch: scenario.includeEmployerMatch ?? false,
    takeHomeDefinition: scenario.takeHomeDefinition ?? "NET_TO_CHECKING",
    currentMonthlySpend: scenario.currentMonthlySpend ?? DEFAULT_CURRENT_MONTHLY_SPEND,
    withdrawalOrderBuckets:
      scenario.withdrawalOrderBuckets ?? [...DEFAULT_WITHDRAWAL_BUCKETS],
    retireWhen: scenario.retireWhen ?? "EITHER",
    retirementStartYear:
      effectiveRetirementStartYear ?? scenario.retirementStartYear ?? undefined,
    traditionalWithdrawalsTaxRate,
    rothWithdrawalsTaxRate: scenario.rothWithdrawalsTaxRate ?? 0,
    taxableWithdrawalsTaxRate:
      scenario.taxableWithdrawalsTaxRate ?? DEFAULT_TAXABLE_WITHDRAWAL_TAX_RATE,
    autoFixOverflow: scenario.autoFixOverflow ?? false,
    enableUnallocatedSurplusBalancing:
      scenario.enableUnallocatedSurplusBalancing ?? true,
    unallocatedSurplusFrequency:
      scenario.unallocatedSurplusFrequency ?? "Monthly",
  };
}
