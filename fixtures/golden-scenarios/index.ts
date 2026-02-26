/**
 * Golden scenario fixtures for snapshot testing.
 * Per Accuracy MVP Phase 9: base, with RSU, with employer match.
 */

import type { Household, Scenario } from "@/lib/types/zod";

const START_YEAR = 2025;

function createBaseHousehold(overrides?: Partial<Household>): Household {
  return {
    id: "hh-golden",
    name: "Golden Test Household",
    startYear: START_YEAR,
    currency: "USD",
    people: [
      {
        id: "p1",
        name: "Person A",
        birthYear: 1990,
        income: {
          baseSalaryAnnual: 200_000,
          salaryGrowthRate: 0,
          salaryGrowthIsReal: true,
        },
        payroll: {
          payrollInvesting: [],
          payrollDeductionsSpending: 0,
        },
      },
    ],
    accounts: [
      {
        id: "inv",
        name: "401k",
        type: "TRADITIONAL_401K",
        owner: "PERSON_A",
        startingBalance: 100_000,
        includedInFIAssets: true,
      },
    ],
    scenarios: [],
    outOfPocketInvesting: [],
    monthlySavings: [],
    events: [],
    equityGrants: [],
    ...overrides,
  };
}

function createBaseScenario(overrides?: Partial<Scenario>): Scenario {
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
    currentMonthlySpend: 5000,
    retirementAgeTarget: 65,
    salaryGrowthOverride: null,
    salaryGrowthMode: "REAL",
    includeEmployerMatch: false,
    withdrawalOrder: ["TAXABLE", "TRADITIONAL_401K", "ROTH_401K", "ROTH_IRA"],
    withdrawalOrderBuckets: ["TAXABLE", "TAX_DEFERRED", "ROTH"],
    rothWithdrawalsTaxRate: 0,
    taxableWithdrawalsTaxRate: 0,
    contributionOverrides: [],
    eventOverrides: [],
    autoFixOverflow: false,
    enableUnallocatedSurplusBalancing: true,
    unallocatedSurplusFrequency: "Monthly" as const,
    retireWhen: "EITHER",
    equityGrantOverrides: [],
    ...overrides,
  };
}

/** Base scenario: salary, no RSU, no employer match. */
export function getBaseScenario(): { household: Household; scenario: Scenario } {
  return {
    household: createBaseHousehold(),
    scenario: createBaseScenario(),
  };
}

/** RSU scenario: equity grant vests in year 2, net proceeds to taxable. */
export function getRsuScenario(): { household: Household; scenario: Scenario } {
  const brokerageId = "brokerage";
  return {
    household: createBaseHousehold({
      accounts: [
        {
          id: "inv",
          name: "401k",
          type: "TRADITIONAL_401K",
          owner: "PERSON_A",
          startingBalance: 100_000,
          includedInFIAssets: true,
        },
        {
          id: brokerageId,
          name: "Taxable Brokerage",
          type: "TAXABLE",
          owner: "PERSON_A",
          startingBalance: 0,
          includedInFIAssets: true,
        },
      ],
      equityGrants: [
        {
          id: "rsu1",
          ownerPersonId: "p1",
          type: "RSU",
          startYear: START_YEAR,
          vestingTable: [{ year: START_YEAR + 2, shares: 100 }],
          priceAssumption: { mode: "FIXED", fixedPrice: 300 },
          withholdingRate: 0.22,
          destinationAccountId: brokerageId,
          sellStrategy: "SELL_ALL",
        },
      ],
    }),
    scenario: createBaseScenario(),
  };
}

/** Employer match scenario: employee + employer 401k contributions. */
export function getEmployerMatchScenario(): {
  household: Household;
  scenario: Scenario;
} {
  const tradId = "trad";
  return {
    household: createBaseHousehold({
      accounts: [
        {
          id: tradId,
          name: "401k",
          type: "TRADITIONAL_401K",
          owner: "PERSON_A",
          startingBalance: 50_000,
          includedInFIAssets: true,
        },
      ],
      people: [
        {
          id: "p1",
          name: "Person A",
          birthYear: 1990,
          income: {
            baseSalaryAnnual: 200_000,
            salaryGrowthRate: 0,
            salaryGrowthIsReal: true,
          },
          payroll: {
            payrollInvesting: [
              { accountId: tradId, amountAnnual: 15_000, contributorType: "employee" },
              { accountId: tradId, amountAnnual: 7_500, contributorType: "employer" },
            ],
            payrollDeductionsSpending: 0,
          },
        },
      ],
    }),
    scenario: createBaseScenario({ includeEmployerMatch: true }),
  };
}
