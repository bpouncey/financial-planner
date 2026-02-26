import { describe, it, expect } from "vitest";
import { getEffectiveScenarioForExport } from "./effective-scenario";
import type { Household, Scenario } from "@/lib/types/zod";

function createMinimalHousehold(overrides?: Partial<Household>): Household {
  return {
    id: "hh-1",
    name: "Test",
    startYear: 2025,
    currency: "USD",
    people: [{ id: "p1", name: "Person", birthYear: 1990, income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: true }, payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 } }],
    accounts: [],
    scenarios: [],
    outOfPocketInvesting: [],
    monthlySavings: [],
    events: [],
    equityGrants: [],
    ...overrides,
  };
}

function createMinimalScenario(overrides?: Partial<Scenario>): Scenario {
  return {
    id: "s1",
    name: "Base",
    modelingMode: "REAL",
    nominalReturn: 0.07,
    inflation: 0.03,
    effectiveTaxRate: 0.25,
    takeHomeAnnual: null,
    takeHomeDefinition: "NET_TO_CHECKING",
    swr: 0.03,
    retirementMonthlySpend: 8000,
    retirementAgeTarget: 65,
    salaryGrowthMode: "REAL",
    includeEmployerMatch: false,
    retireWhen: "EITHER",
    withdrawalOrder: ["TAXABLE", "TRADITIONAL_401K", "ROTH_401K", "ROTH_IRA"],
    withdrawalOrderBuckets: ["TAXABLE", "TAX_DEFERRED", "ROTH"],
    ...overrides,
  } as Scenario;
}

describe("getEffectiveScenarioForExport", () => {
  it("applies taxableWithdrawalsTaxRate default (0.10) when undefined", () => {
    const household = createMinimalHousehold();
    const scenario = createMinimalScenario({
      taxableWithdrawalsTaxRate: undefined,
    });
    const effective = getEffectiveScenarioForExport(household, scenario);
    expect(effective.taxableWithdrawalsTaxRate).toBe(0.1);
  });

  it("preserves explicit taxableWithdrawalsTaxRate when set", () => {
    const household = createMinimalHousehold();
    const scenario = createMinimalScenario({ taxableWithdrawalsTaxRate: 0 });
    const effective = getEffectiveScenarioForExport(household, scenario);
    expect(effective.taxableWithdrawalsTaxRate).toBe(0);
  });

  it("applies traditionalWithdrawalsTaxRate from retirementEffectiveTaxRate when both undefined", () => {
    const household = createMinimalHousehold();
    const scenario = createMinimalScenario({
      traditionalWithdrawalsTaxRate: undefined,
      retirementEffectiveTaxRate: 0.2,
    });
    const effective = getEffectiveScenarioForExport(household, scenario);
    expect(effective.traditionalWithdrawalsTaxRate).toBe(0.2);
  });

  it("computes retirementStartYear when retireWhen is AGE and not set", () => {
    const household = createMinimalHousehold({
      people: [{ id: "p1", name: "Person", birthYear: 1990, income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: true }, payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 } }],
    });
    const scenario = createMinimalScenario({
      retireWhen: "AGE",
      retirementStartYear: undefined,
      retirementAgeTarget: 65,
    });
    const effective = getEffectiveScenarioForExport(household, scenario);
    expect(effective.retirementStartYear).toBe(1990 + 65);
  });

  it("applies currentMonthlySpend default (6353) when undefined", () => {
    const household = createMinimalHousehold();
    const scenario = createMinimalScenario({ currentMonthlySpend: undefined });
    const effective = getEffectiveScenarioForExport(household, scenario);
    expect(effective.currentMonthlySpend).toBe(6353);
  });
});
