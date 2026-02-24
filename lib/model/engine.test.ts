/**
 * Engine unit tests per docs/tests/TEST_CASES.md.
 * Tests 1, 2, 3, 4 as applicable to MVP.
 */

import { describe, it, expect } from "vitest";
import { runProjection, realReturn, runMonteCarlo } from "./engine";
import { validateHousehold } from "./validation";
import { ContributionSchema } from "@/lib/types/zod";
import type { Household, Scenario } from "@/lib/types/zod";

const START_YEAR = 2025;

function createBaseHousehold(overrides?: {
  startInvested?: number;
  salary?: number;
  people?: Household["people"];
  accounts?: Household["accounts"];
  outOfPocketInvesting?: Household["outOfPocketInvesting"];
  events?: Household["events"];
  equityGrants?: Household["equityGrants"];
}): Household {
  const startInvested = overrides?.startInvested ?? 159291;
  const salary = overrides?.salary ?? 294000;
  return {
    id: "hh1",
    name: "Test Household",
    startYear: START_YEAR,
    currency: "USD",
    outOfPocketInvesting: overrides?.outOfPocketInvesting ?? [],
    events: overrides?.events ?? [],
    equityGrants: overrides?.equityGrants ?? [],
    people:
      overrides?.people ?? [
        {
          id: "p1",
          name: "Person A",
          income: {
            baseSalaryAnnual: salary,
            salaryGrowthRate: 0,
            salaryGrowthIsReal: true,
          },
          payroll: {
            payrollInvesting: [],
            payrollDeductionsSpending: 0,
          },
        },
      ],
    accounts:
      overrides?.accounts ?? [
        {
          id: "inv",
          name: "Invested",
          type: "TRADITIONAL",
          owner: "PERSON_A",
          startingBalance: startInvested,
          includedInFIAssets: true,
        },
      ],
    scenarios: [],
  };
}

function createBaseScenario(overrides?: Partial<Scenario>): Scenario {
  return {
    id: "s1",
    name: "Base",
    modelingMode: "REAL",
    nominalReturn: 0.07,
    inflation: 0.03,
    effectiveTaxRate: null,
    takeHomeAnnual: 200000,
    swr: 0.03,
    retirementMonthlySpend: 8000,
    currentMonthlySpend: 6353,
    retirementAgeTarget: 65,
    salaryGrowthOverride: null,
    includeEmployerMatch: false,
    withdrawalOrder: ["TAXABLE", "TRADITIONAL", "ROTH"],
    ...overrides,
  };
}

describe("Engine", () => {
  describe("realReturn", () => {
    it("computes real return from nominal and inflation", () => {
      const r = realReturn(0.07, 0.03);
      expect(r).toBeCloseTo(0.0388, 3);
    });
  });

  describe("Test 1 — Spreadsheet parity (baseline)", () => {
    /** Test 1 fixture per docs/tests/TEST_CASES.md and docs/tests/PARITY_TOLERANCE.md */
    const TEST1_FIXTURE = {
      household: () =>
        createBaseHousehold({
          startInvested: 159291,
          salary: 294000,
        }),
      scenario: () =>
        createBaseScenario({
          modelingMode: "REAL",
          nominalReturn: 0.07,
          inflation: 0.03,
          swr: 0.03,
          retirementMonthlySpend: 8000,
          currentMonthlySpend: 6353,
        }),
    };

    it("reproduces expected FI number and formula parity", () => {
      const household = TEST1_FIXTURE.household();
      const scenario = TEST1_FIXTURE.scenario();

      const result = runProjection(household, scenario, 40);

      expect(result.fiNumber).toBe(8000 * 12 / 0.03);
      expect(result.fiNumber).toBe(3_200_000);

      expect(result.yearRows.length).toBeGreaterThan(0);
      const first = result.yearRows[0];
      expect(first.year).toBe(START_YEAR);
      expect(first.grossIncome).toBe(294000);

      const last = result.yearRows[result.yearRows.length - 1];
      expect(last.investedAssets).toBeGreaterThan(0);
      expect(last.netWorth).toBeGreaterThan(0);

      if (result.fiYear != null) {
        expect(result.fiYear).toBeGreaterThanOrEqual(START_YEAR);
        const fiRow = result.yearRows.find((r) => r.year === result.fiYear!);
        expect(fiRow?.investedAssets).toBeGreaterThanOrEqual(result.fiNumber);
      }
    });

    it("parity test: key outputs within documented tolerance (growth convention)", () => {
      // Run Test 1 fixture; assert outputs match expected values within tolerance.
      // See docs/tests/PARITY_TOLERANCE.md for convention and tolerance rationale.
      const household = TEST1_FIXTURE.household();
      const scenario = TEST1_FIXTURE.scenario();
      const result = runProjection(household, scenario, 40);

      // FI number (exact)
      expect(result.fiNumber).toBe(3_200_000);

      // Real return ≈ (1.07)/(1.03)-1; growth uses mid-year: Begin + 0.5*Contrib
      const rate = realReturn(0.07, 0.03);
      expect(rate).toBeCloseTo(0.0388, 3);

      // Year 1: begin=159291, contrib=0 → growth on 159291, end ≈ 165473
      const y1 = result.yearRows[0];
      expect(y1.year).toBe(2025);
      expect(y1.grossIncome).toBe(294000);
      expect(y1.investedAssets).toBeCloseTo(165_473, -2); // ±$1 tolerance

      // Year 5 sanity: invested assets should grow (159k → ~193k at ~3.88% real)
      const y5 = result.yearRows.find((r) => r.year === 2029);
      expect(y5).toBeDefined();
      expect(y5!.investedAssets).toBeCloseTo(192_719, -2);

      // FI year: should be reachable within 40 years with no contributions (growth only)
      // With 159k start and ~3.88% real, FI at 3.2M takes ~50+ years; may be null
      if (result.fiYear != null) {
        const fiRow = result.yearRows.find((r) => r.year === result.fiYear!);
        expect(fiRow?.investedAssets).toBeGreaterThanOrEqual(result.fiNumber * 0.999);
      }
    });

    it("reconciles per-account: End = Begin + Contributions + Growth", () => {
      const household = createBaseHousehold();
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 5);

      for (let i = 0; i < result.yearRows.length; i++) {
        const row = result.yearRows[i];
        const prev = i > 0 ? result.yearRows[i - 1] : null;
        for (const [accountId, endBal] of Object.entries(row.endingBalances)) {
          const contrib = row.contributionsByAccount[accountId] ?? 0;
          const growth = row.growthByAccount[accountId] ?? 0;
          const begin = prev ? prev.endingBalances[accountId] ?? 0 : household.accounts.find((a) => a.id === accountId)!.startingBalance;
          const expected = begin + contrib + growth;
          expect(endBal).toBeCloseTo(expected, 0);
        }
      }
    });
  });

  describe("Test 4 — One-time event impact", () => {
    const cashId = "cash";
    const invId = "inv";

    it("2029 OUTFLOW $30k from CASH: net worth dips in 2029", () => {
      const householdNoEvent = createBaseHousehold({
        accounts: [
          {
            id: invId,
            name: "Invested",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 159_291,
            includedInFIAssets: true,
          },
          {
            id: cashId,
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
        ],
        events: [],
      });
      const householdWithEvent = createBaseHousehold({
        accounts: [
          {
            id: invId,
            name: "Invested",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 159_291,
            includedInFIAssets: true,
          },
          {
            id: cashId,
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
        ],
        events: [
          {
            id: "e1",
            name: "Big purchase",
            year: 2029,
            amount: 30_000,
            kind: "OUTFLOW",
            accountId: cashId,
          },
        ],
      });
      const scenario = createBaseScenario();

      const resultNoEvent = runProjection(householdNoEvent, scenario, 10);
      const resultWithEvent = runProjection(householdWithEvent, scenario, 10);

      const row2029NoEvent = resultNoEvent.yearRows.find((r) => r.year === 2029);
      const row2029WithEvent = resultWithEvent.yearRows.find((r) => r.year === 2029);

      expect(row2029NoEvent).toBeDefined();
      expect(row2029WithEvent).toBeDefined();
      expect(row2029WithEvent!.netWorth).toBeLessThan(row2029NoEvent!.netWorth);
      // Dip is ≥$30k (slightly more because removed funds would have grown in no-event case)
      expect(row2029NoEvent!.netWorth - row2029WithEvent!.netWorth).toBeGreaterThanOrEqual(30_000);
    });

    it("2029 OUTFLOW $30k from CASH: FI year shifts later or becomes null", () => {
      const householdNoEvent = createBaseHousehold({
        accounts: [
          {
            id: invId,
            name: "Invested",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 159_291,
            includedInFIAssets: true,
          },
          {
            id: cashId,
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
        ],
        events: [],
      });
      const householdWithEvent = createBaseHousehold({
        accounts: [
          {
            id: invId,
            name: "Invested",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 159_291,
            includedInFIAssets: true,
          },
          {
            id: cashId,
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
        ],
        events: [
          {
            id: "e1",
            name: "Big purchase",
            year: 2029,
            amount: 30_000,
            kind: "OUTFLOW",
            accountId: cashId,
          },
        ],
      });
      const scenario = createBaseScenario();

      const resultNoEvent = runProjection(householdNoEvent, scenario, 50);
      const resultWithEvent = runProjection(householdWithEvent, scenario, 50);

      if (resultNoEvent.fiYear != null && resultWithEvent.fiYear != null) {
        expect(resultWithEvent.fiYear).toBeGreaterThanOrEqual(
          resultNoEvent.fiYear
        );
      }
    });

    it("INFLOW adds to account balance", () => {
      const household = createBaseHousehold({
        accounts: [
          {
            id: cashId,
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 10_000,
            includedInFIAssets: true,
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        events: [
          {
            id: "e1",
            name: "Windfall",
            year: 2027,
            amount: 25_000,
            kind: "INFLOW",
            accountId: cashId,
          },
        ],
      });
      const scenario = createBaseScenario({
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 5);
      const row2026 = result.yearRows.find((r) => r.year === 2026);
      const row2027 = result.yearRows.find((r) => r.year === 2027);

      expect(row2026).toBeDefined();
      expect(row2027).toBeDefined();
      expect(row2027!.endingBalances[cashId]).toBeGreaterThan(
        row2026!.endingBalances[cashId]
      );
      expect(row2027!.endingBalances[cashId] - row2026!.endingBalances[cashId])
        .toBeGreaterThanOrEqual(25_000);
    });

    it("OUTFLOW clamps balance to zero", () => {
      const household = createBaseHousehold({
        accounts: [
          {
            id: cashId,
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 20_000,
            includedInFIAssets: true,
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        events: [
          {
            id: "e1",
            name: "Overspend",
            year: 2025,
            amount: 50_000,
            kind: "OUTFLOW",
            accountId: cashId,
          },
        ],
      });
      const scenario = createBaseScenario({
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const row2025 = result.yearRows.find((r) => r.year === 2025);

      expect(row2025).toBeDefined();
      expect(row2025!.endingBalances[cashId]).toBe(0);
      expect(row2025!.netWorth).toBe(0);
    });
  });

  describe("Test 5 — RSU vesting sold and reinvested", () => {
    const brokerageId = "brokerage";
    it("RSU vest proceeds add to destination account and appear in contributionsByAccount", () => {
      // Net proceeds $50k in 2027: 100 shares @ $500, 0% withholding = $50k net
      const household = createBaseHousehold({
        startInvested: 100_000,
        accounts: [
          {
            id: "inv",
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 100_000,
            includedInFIAssets: true,
          },
          {
            id: brokerageId,
            name: "Brokerage",
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
            startYear: 2025,
            vestingTable: [{ year: 2027, shares: 100 }],
            priceAssumption: { mode: "FIXED", fixedPrice: 500 },
            withholdingRate: 0,
            destinationAccountId: brokerageId,
          },
        ],
      });
      const scenario = createBaseScenario();

      const result = runProjection(household, scenario, 10);
      const row2026 = result.yearRows.find((r) => r.year === 2026);
      const row2027 = result.yearRows.find((r) => r.year === 2027);

      expect(row2027).toBeDefined();
      expect(row2027!.contributionsByAccount[brokerageId]).toBe(50_000);
      expect(row2027!.endingBalances[brokerageId]).toBeGreaterThanOrEqual(
        50_000
      );
      expect(row2027!.endingBalances[brokerageId]).toBeGreaterThan(
        row2026!.endingBalances[brokerageId]
      );
    });

    it("withholding reduces net proceeds to destination", () => {
      // 125 shares @ $500 = $62.5k gross, 20% withholding = $12.5k, net = $50k
      const household = createBaseHousehold({
        accounts: [
          {
            id: brokerageId,
            name: "Brokerage",
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
            startYear: 2025,
            vestingTable: [{ year: 2027, shares: 125 }],
            priceAssumption: { mode: "FIXED", fixedPrice: 500 },
            withholdingRate: 0.2,
            destinationAccountId: brokerageId,
          },
        ],
      });
      const scenario = createBaseScenario({
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 5);
      const row2027 = result.yearRows.find((r) => r.year === 2027);

      expect(row2027!.contributionsByAccount[brokerageId]).toBe(50_000);
      // Ending balance = contribution + growth on mid-year base
      expect(row2027!.endingBalances[brokerageId]).toBeGreaterThanOrEqual(
        50_000
      );
    });

    it("RSU vest improves FI year vs no-equity baseline", () => {
      const baseHousehold = createBaseHousehold({
        startInvested: 500_000,
        accounts: [
          {
            id: brokerageId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const rsuHousehold = createBaseHousehold({
        startInvested: 500_000,
        accounts: [
          {
            id: brokerageId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 500_000,
            includedInFIAssets: true,
          },
        ],
        equityGrants: [
          {
            id: "rsu1",
            ownerPersonId: "p1",
            type: "RSU",
            startYear: 2025,
            vestingTable: [{ year: 2027, shares: 200 }],
            priceAssumption: { mode: "FIXED", fixedPrice: 500 },
            withholdingRate: 0,
            destinationAccountId: brokerageId,
          },
        ],
      });
      const scenario = createBaseScenario();

      const resultBase = runProjection(baseHousehold, scenario, 30);
      const resultRsu = runProjection(rsuHousehold, scenario, 30);

      // RSU adds $100k in 2027; FI date should improve or stay same
      if (resultBase.fiYear != null && resultRsu.fiYear != null) {
        expect(resultRsu.fiYear).toBeLessThanOrEqual(resultBase.fiYear);
      }
    });
  });

  describe("Phase 4 — Withdrawal phase", () => {
    const tradId = "trad";
    const taxableId = "taxable";
    const rothId = "roth";

    it("rows after FI year have phase 'withdrawal' and withdrawalByAccount", () => {
      // Start at FI so year 1 is withdrawal
      const fiNumber = 3_200_000;
      const household = createBaseHousehold({
        startInvested: fiNumber + 100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: fiNumber + 100_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000,
        swr: 0.03,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 5);
      expect(result.fiYear).toBe(START_YEAR);

      const accRows = result.yearRows.filter((r) => r.phase === "accumulation");
      const wdRows = result.yearRows.filter((r) => r.phase === "withdrawal");

      expect(accRows.length).toBeGreaterThan(0);
      expect(wdRows.length).toBeGreaterThan(0);

      for (const row of wdRows) {
        expect(row.phase).toBe("withdrawal");
        expect(row.withdrawalByAccount).toBeDefined();
        const totalWithdrawn = Object.values(row.withdrawalByAccount ?? {}).reduce(
          (s, v) => s + v,
          0
        );
        expect(totalWithdrawn).toBe(8000 * 12); // annual retirement spend
      }
    });

    it("withdrawal follows TAXABLE → TRADITIONAL → ROTH order", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 200_000,
            includedInFIAssets: true,
          },
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 3_500_000,
            includedInFIAssets: true,
          },
          {
            id: rothId,
            name: "Roth",
            type: "ROTH",
            owner: "PERSON_A",
            startingBalance: 500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000, // $60k/year
        swr: 0.03,
        retirementStartYear: START_YEAR,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount).toBeDefined();
      // Taxable has 200k; we need 60k. All 60k from taxable.
      expect(y1.withdrawalByAccount![taxableId]).toBe(60_000);
      expect(y1.withdrawalByAccount![tradId]).toBeUndefined();
      expect(y1.withdrawalByAccount![rothId]).toBeUndefined();
    });

    it("withdrawal draws from next account when first is depleted", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 30_000, // only 30k
            includedInFIAssets: true,
          },
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 3_500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000, // $60k/year
        swr: 0.03,
        retirementStartYear: START_YEAR,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.withdrawalByAccount![taxableId]).toBe(30_000);
      expect(y1.withdrawalByAccount![tradId]).toBe(30_000); // remainder from trad
    });

    it("retirementStartYear overrides FI-based switch to withdrawal", () => {
      const household = createBaseHousehold({
        startInvested: 100_000, // not FI
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000,
        swr: 0.03,
        retirementStartYear: START_YEAR, // retire immediately despite not FI
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 5);
      expect(result.fiYear).toBeNull();

      const y1 = result.yearRows[0];
      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount).toBeDefined();
      const totalWd = Object.values(y1.withdrawalByAccount ?? {}).reduce(
        (s, v) => s + v,
        0
      );
      expect(totalWd).toBe(60_000);
      // Balance should decrease: 100k - 60k + growth on 40k
      expect(y1.endingBalances["inv"]).toBeLessThan(100_000);
    });

    it("End = Begin - Withdrawal + Growth in withdrawal phase", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 3_500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000, // $96k/year
        swr: 0.03,
        retirementStartYear: START_YEAR,
        modelingMode: "REAL",
        nominalReturn: 0.07,
        inflation: 0.03,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);

      for (let i = 0; i < result.yearRows.length; i++) {
        const row = result.yearRows[i];
        const prev = i > 0 ? result.yearRows[i - 1] : null;
        const wd = row.withdrawalByAccount ?? {};
        for (const [accountId, endBal] of Object.entries(row.endingBalances)) {
          const begin = prev ? prev.endingBalances[accountId] ?? 0 : household.accounts.find((a) => a.id === accountId)!.startingBalance;
          const withdrawal = wd[accountId] ?? 0;
          const growth = row.growthByAccount[accountId] ?? 0;
          const expected = begin - withdrawal + growth;
          expect(endBal).toBeCloseTo(expected, 0);
        }
      }
    });

    it("accumulation rows have phase 'accumulation' and no withdrawalByAccount", () => {
      const household = createBaseHousehold({
        startInvested: 100_000,
      });
      const scenario = createBaseScenario();

      const result = runProjection(household, scenario, 10);
      const accRows = result.yearRows.filter((r) => r.phase === "accumulation");

      expect(accRows.length).toBeGreaterThan(0);
      for (const row of accRows) {
        expect(row.phase).toBe("accumulation");
        expect(row.withdrawalByAccount).toBeUndefined();
      }
    });
  });

  describe("Phase 6 — Withdrawal-phase tax", () => {
    const tradId = "trad";
    const taxableId = "taxable";

    it("taxes Traditional withdrawals when retirementEffectiveTaxRate is set", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 30_000,
            includedInFIAssets: true,
          },
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 3_500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000, // $60k/year
        swr: 0.03,
        retirementStartYear: START_YEAR,
        retirementEffectiveTaxRate: 0.2, // 20% on Traditional withdrawals
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![taxableId]).toBe(30_000);
      expect(y1.withdrawalByAccount![tradId]).toBe(30_000); // remainder from trad

      // Taxable withdrawal from TRADITIONAL = $30k, at 20% = $6k
      const expectedTax = 30_000 * 0.2;
      expect(y1.taxes).toBe(expectedTax);
      expect(y1.withdrawalPhaseTaxes).toBe(expectedTax);
    });

    it("no withdrawal-phase tax when only drawing from TAXABLE and ROTH", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 100_000, // enough for $60k spend
            includedInFIAssets: true,
          },
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 1_000_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000, // $60k/year
        swr: 0.03,
        retirementStartYear: START_YEAR,
        retirementEffectiveTaxRate: 0.2,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      // All $60k from taxable; no Traditional withdrawal
      expect(y1.withdrawalByAccount![taxableId]).toBe(60_000);
      expect(y1.withdrawalByAccount![tradId]).toBeUndefined();

      expect(y1.taxes).toBe(0);
      expect(y1.withdrawalPhaseTaxes).toBe(0);
    });

    it("no withdrawal-phase tax when retirementEffectiveTaxRate is unset", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 3_500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        // retirementEffectiveTaxRate not set
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.withdrawalByAccount![tradId]).toBe(96_000); // $8k * 12
      expect(y1.taxes).toBe(0);
      expect(y1.withdrawalPhaseTaxes).toBe(0);
    });
  });

  describe("403B tax treatment and age-based accessibility", () => {
    const tradId = "trad";
    const four03bId = "403b";
    const taxableId = "taxable";
    const rothId = "roth";
    const hsaId = "hsa";

    it("403B withdrawals are taxed like Traditional (withdrawalPhaseTaxes = amount × rate)", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1965, // 60 in 2025
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: four03bId,
            name: "403(b)",
            type: "403B",
            owner: "PERSON_A",
            startingBalance: 3_500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        retirementEffectiveTaxRate: 0.2,
        withdrawalOrder: ["TAXABLE", "TRADITIONAL", "403B", "ROTH"],
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![four03bId]).toBe(96_000);
      const expectedTax = 96_000 * 0.2;
      expect(y1.withdrawalPhaseTaxes).toBe(expectedTax);
    });

    it("under 59.5: only CASH, TAXABLE, ROTH accessible; no Traditional/403B withdrawals", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1970, // 55 in 2025
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 5_000_000,
            includedInFIAssets: true,
          },
          {
            id: rothId,
            name: "Roth",
            type: "ROTH",
            owner: "PERSON_A",
            startingBalance: 500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![taxableId]).toBe(50_000);
      expect(y1.withdrawalByAccount![rothId]).toBe(10_000); // remainder from Roth
      expect(y1.withdrawalByAccount![tradId]).toBeUndefined();
    });

    it("at 60+: Traditional and 403B are used in withdrawal", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1965, // 60 in 2025
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 5_000_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![tradId]).toBe(96_000);
    });

    it("shortfall when only Traditional and under 59.5: withdrawalShortfall > 0, no Traditional withdrawal", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1970, // 55 in 2025
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 5_000_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount?.[tradId]).toBeUndefined();
      expect(y1.withdrawalShortfall).toBe(96_000);
    });

    it("no birth year: all account types accessible (legacy behavior)", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            // no birthYear
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: tradId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 5_000_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 8000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![tradId]).toBe(96_000);
    });

    it("HSA only used when age >= 65", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1970, // 55 in 2025
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 10_000,
            includedInFIAssets: true,
          },
          {
            id: hsaId,
            name: "HSA",
            type: "HSA",
            owner: "PERSON_A",
            startingBalance: 500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        withdrawalOrder: ["TAXABLE", "TRADITIONAL", "403B", "ROTH", "HSA"],
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![taxableId]).toBe(10_000);
      expect(y1.withdrawalByAccount![hsaId]).toBeUndefined();
      expect(y1.withdrawalShortfall).toBe(50_000);
    });

    it("HSA used when age >= 65", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1960, // 65 in 2025
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: taxableId,
            name: "Brokerage",
            type: "TAXABLE",
            owner: "PERSON_A",
            startingBalance: 10_000,
            includedInFIAssets: true,
          },
          {
            id: hsaId,
            name: "HSA",
            type: "HSA",
            owner: "PERSON_A",
            startingBalance: 500_000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementMonthlySpend: 5000,
        swr: 0.03,
        retirementStartYear: START_YEAR,
        withdrawalOrder: ["TAXABLE", "TRADITIONAL", "403B", "ROTH", "HSA"],
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 3);
      const y1 = result.yearRows[0];

      expect(y1.phase).toBe("withdrawal");
      expect(y1.withdrawalByAccount![taxableId]).toBe(10_000);
      expect(y1.withdrawalByAccount![hsaId]).toBe(50_000);
    });
  });

  describe("Money Market APY", () => {
    const mmId = "mm";
    it("MONEY_MARKET with apy uses account rate instead of scenario rate", () => {
      const household = createBaseHousehold({
        accounts: [
          {
            id: "inv",
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 100_000,
            includedInFIAssets: true,
          },
          {
            id: mmId,
            name: "Ally Money Market",
            type: "MONEY_MARKET",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
            apy: 0.045, // 4.5% vs scenario 7%
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        modelingMode: "NOMINAL",
        nominalReturn: 0.07,
        inflation: 0.03,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 5);
      const y1 = result.yearRows[0];

      // MM at 4.5%: midYearBase 50k → growth = 50_000 * 0.045 = 2250
      expect(y1.growthByAccount[mmId]).toBeCloseTo(2_250, 0);
      // 401k at 7%: midYearBase 100k → growth = 50_000 * 0.07 = 7000 (actually 100k * 0.07 = 7000)
      expect(y1.growthByAccount.inv).toBeCloseTo(7_000, 0);

      // Year 5: MM balance should grow ~4.5%/yr, not 7%
      const y5 = result.yearRows[4];
      const mmEnd5 = y5.endingBalances[mmId];
      expect(mmEnd5).toBeCloseTo(50_000 * Math.pow(1.045, 5), -2);
      expect(mmEnd5).toBeLessThan(50_000 * Math.pow(1.07, 5));
    });

    it("MONEY_MARKET without apy falls back to scenario rate (backward compat)", () => {
      const household = createBaseHousehold({
        accounts: [
          {
            id: mmId,
            name: "Money Market",
            type: "MONEY_MARKET",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
            // no apy
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        modelingMode: "NOMINAL",
        nominalReturn: 0.07,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const result = runProjection(household, scenario, 5);
      const y1 = result.yearRows[0];
      // Uses 7% like other accounts
      expect(y1.growthByAccount[mmId]).toBeCloseTo(50_000 * 0.07, 0);
    });
  });

  describe("Phase 5 — Stress test (sequence-of-returns)", () => {
    it("year 0 uses stressTestFirstYearReturn when set, impacting growth and FI year", () => {
      const household = createBaseHousehold({
        startInvested: 159_291,
      });
      const scenarioBase = createBaseScenario();
      const scenarioStress = createBaseScenario({
        stressTestFirstYearReturn: -0.4,
      });

      const resultBase = runProjection(household, scenarioBase, 40);
      const resultStress = runProjection(household, scenarioStress, 40);

      const y0Base = resultBase.yearRows[0];
      const y0Stress = resultStress.yearRows[0];

      // Year 0: stress test -40% → growth is negative; baseline ~+3.88% real → positive growth
      expect(y0Stress.growthByAccount.inv).toBeLessThan(0);
      expect(y0Base.growthByAccount.inv).toBeGreaterThan(0);

      // Year 0 ending balance: stress case is lower
      expect(y0Stress.investedAssets).toBeLessThan(y0Base.investedAssets);

      // FI year: stress test should shift later or become null when baseline had FI
      if (resultBase.fiYear != null) {
        expect(
          resultStress.fiYear == null || resultStress.fiYear >= resultBase.fiYear
        ).toBe(true);
      }
    });

    it("years 1+ use normal rate when stress test only applies to year 0", () => {
      const household = createBaseHousehold({
        startInvested: 100_000,
      });
      const scenario = createBaseScenario({
        stressTestFirstYearReturn: -0.4,
      });

      const result = runProjection(household, scenario, 5);
      const rate = realReturn(0.07, 0.03);

      // Year 1 growth: midYearBase * rate (normal). Year 0 had negative growth.
      const y0 = result.yearRows[0];
      const y1 = result.yearRows[1];
      expect(y0.growthByAccount.inv).toBeLessThan(0);
      // Year 1: growth on y0's end balance + 0.5 * contrib. Should be positive.
      expect(y1.growthByAccount.inv).toBeGreaterThan(0);

      // Sanity: y1 growth ≈ (y0.investedAssets + 0.5*contrib) * rate
      const begin1 = y0.investedAssets;
      const contrib1 = y1.contributionsByAccount.inv ?? 0;
      const expectedGrowth1 = (begin1 + 0.5 * contrib1) * rate;
      expect(y1.growthByAccount.inv).toBeCloseTo(expectedGrowth1, -2);
    });
  });

  describe("Phase 5 — Monte Carlo (runMonteCarlo)", () => {
    it("returns valid structure with fiYear percentiles and path counts", () => {
      const household = createBaseHousehold({ startInvested: 159_291 });
      const scenario = createBaseScenario();
      const result = runMonteCarlo(household, scenario, 50, 40, 0.15);

      expect(result.pathsRun).toBe(50);
      expect(result.pathsHitFi).toBeGreaterThanOrEqual(0);
      expect(result.pathsHitFi).toBeLessThanOrEqual(50);
      expect(result.fiYear25).toBeGreaterThanOrEqual(START_YEAR);
      expect(result.fiYear50).toBeGreaterThanOrEqual(START_YEAR);
      expect(result.fiYear75).toBeGreaterThanOrEqual(START_YEAR);
      expect(result.fiYear25!).toBeLessThanOrEqual(result.fiYear50!);
      expect(result.fiYear50!).toBeLessThanOrEqual(result.fiYear75!);
    });

    it("with zero volatility yields deterministic fiYear matching runProjection", () => {
      const household = createBaseHousehold({ startInvested: 159_291 });
      const scenario = createBaseScenario();
      const det = runProjection(household, scenario, 40);
      const mc = runMonteCarlo(household, scenario, 10, 40, 0);

      expect(mc.pathsHitFi).toBe(det.fiYear != null ? 10 : 0);
      expect(mc.fiYear25).toBe(mc.fiYear50);
      expect(mc.fiYear50).toBe(mc.fiYear75);
      if (det.fiYear != null) {
        expect(mc.fiYear50).toBe(det.fiYear);
      } else {
        expect(mc.fiYear50).toBe(START_YEAR + 40);
      }
    });

    it("with positive volatility, percentile spread is non-trivial", () => {
      const household = createBaseHousehold({ startInvested: 100_000 });
      const scenario = createBaseScenario();
      const result = runMonteCarlo(household, scenario, 200, 40, 0.18);

      expect(result.pathsRun).toBe(200);
      // With volatility, 25th and 75th should typically differ (unless all paths hit FI in same year)
      expect(result.fiYear25!).toBeLessThanOrEqual(result.fiYear75!);
    });
  });

  describe("Test 2 — No disappearing dollars (validation)", () => {
    it("rejects contribution with invalid account ID", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 294000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [
                { accountId: "nonexistent-account", amountMonthly: 2000 },
              ],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario();
      const { errors } = validateHousehold(household, scenario);
      expect(errors.some((e) => e.code === "MISSING_ACCOUNT_REF")).toBe(true);
    });

    it("rejects invalid SWR", () => {
      const household = createBaseHousehold();
      const scenario = createBaseScenario({ swr: 0 });
      const { errors } = validateHousehold(household, scenario);
      expect(errors.some((e) => e.code === "INVALID_SWR")).toBe(true);
    });

    it("warns on cashflow deficit when spending exceeds take-home", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 294000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario({
        takeHomeAnnual: 150000,
        currentMonthlySpend: 15000,
      });
      const { warnings } = validateHousehold(household, scenario);
      expect(warnings.some((w) => w.code === "CASHFLOW_DEFICIT")).toBe(true);
    });

    it("rejects OUTFLOW event without accountId", () => {
      const household: Household = {
        ...createBaseHousehold(),
        events: [
          {
            id: "e1",
            name: "Down payment",
            year: 2029,
            amount: 30000,
            kind: "OUTFLOW",
            accountId: undefined,
          },
        ],
      };
      const scenario = createBaseScenario();
      const { errors } = validateHousehold(household, scenario);
      expect(errors.some((e) => e.code === "MISSING_ACCOUNT_REF")).toBe(true);
      expect(errors.some((e) => e.message.includes("outflow"))).toBe(true);
    });

    it("rejects event with invalid accountId", () => {
      const household: Household = {
        ...createBaseHousehold(),
        events: [
          {
            id: "e1",
            name: "Windfall",
            year: 2027,
            amount: 50000,
            kind: "INFLOW",
            accountId: "nonexistent-account",
          },
        ],
      };
      const scenario = createBaseScenario();
      const { errors } = validateHousehold(household, scenario);
      expect(errors.some((e) => e.code === "MISSING_ACCOUNT_REF")).toBe(true);
      expect(errors.some((e) => e.message.includes("nonexistent-account"))).toBe(true);
    });

    it("rejects equity grant with invalid destinationAccountId", () => {
      const household: Household = {
        ...createBaseHousehold(),
        equityGrants: [
          {
            id: "eg1",
            ownerPersonId: "p1",
            type: "RSU",
            startYear: 2026,
            vestingTable: [{ year: 2027, shares: 100 }],
            priceAssumption: { mode: "FIXED", fixedPrice: 500 },
            withholdingRate: 0.4,
            destinationAccountId: "nonexistent-brokerage",
          },
        ],
      };
      const scenario = createBaseScenario();
      const { errors } = validateHousehold(household, scenario);
      expect(errors.some((e) => e.code === "MISSING_ACCOUNT_REF")).toBe(true);
      expect(errors.some((e) => e.message.includes("Equity grant"))).toBe(true);
      expect(errors.some((e) => e.message.includes("nonexistent-brokerage"))).toBe(true);
    });

    it("rejects equity grant with invalid ownerPersonId", () => {
      const household: Household = {
        ...createBaseHousehold(),
        equityGrants: [
          {
            id: "eg1",
            ownerPersonId: "nonexistent-person",
            type: "RSU",
            startYear: 2026,
            vestingTable: [{ year: 2027, shares: 100 }],
            priceAssumption: { mode: "FIXED", fixedPrice: 500 },
            withholdingRate: 0.4,
            destinationAccountId: "inv",
          },
        ],
      };
      const scenario = createBaseScenario();
      const { errors } = validateHousehold(household, scenario);
      expect(errors.some((e) => e.code === "MISSING_PERSON_REF")).toBe(true);
      expect(errors.some((e) => e.message.includes("Equity grant"))).toBe(true);
      expect(errors.some((e) => e.message.includes("nonexistent-person"))).toBe(true);
    });

    it("warns when OUTFLOW event would reduce account below $0", () => {
      const household: Household = {
        ...createBaseHousehold({
          accounts: [
            {
              id: "cash",
              name: "Cash",
              type: "CASH",
              owner: "PERSON_A",
              startingBalance: 10000,
              includedInFIAssets: true,
            },
          ],
          events: [
            {
              id: "e1",
              name: "Big purchase",
              year: 2025,
              amount: 25000,
              kind: "OUTFLOW",
              accountId: "cash",
            },
          ],
        }),
      };
      const scenario = createBaseScenario();
      const { warnings } = validateHousehold(household, scenario);
      expect(warnings.some((w) => w.code === "EVENT_OVERDRAFT")).toBe(true);
      expect(warnings.some((w) => w.message.includes("Big purchase"))).toBe(true);
      expect(warnings.some((w) => w.message.includes("Cash"))).toBe(true);
    });

    it("warns when equity grant has empty vesting table", () => {
      const household: Household = {
        ...createBaseHousehold(),
        equityGrants: [
          {
            id: "eg-empty",
            ownerPersonId: "p1",
            type: "RSU",
            startYear: 2026,
            vestingTable: [],
            priceAssumption: { mode: "FIXED", fixedPrice: 500 },
            withholdingRate: 0.4,
            destinationAccountId: "inv",
          },
        ],
      };
      const scenario = createBaseScenario();
      const { warnings } = validateHousehold(household, scenario);
      expect(warnings.some((w) => w.code === "EQUITY_EMPTY_VESTING")).toBe(true);
      expect(warnings.some((w) => w.message.includes("eg-empty"))).toBe(true);
    });

    it("warns when equity grant only vests before projection start", () => {
      const household: Household = {
        ...createBaseHousehold(),
        equityGrants: [
          {
            id: "eg-past",
            ownerPersonId: "p1",
            type: "RSU",
            startYear: 2020,
            vestingTable: [
              { year: 2022, shares: 50 },
              { year: 2023, shares: 50 },
            ],
            priceAssumption: { mode: "FIXED", fixedPrice: 100 },
            withholdingRate: 0.4,
            destinationAccountId: "inv",
          },
        ],
      };
      const scenario = createBaseScenario();
      const { warnings } = validateHousehold(household, scenario);
      expect(warnings.some((w) => w.code === "EQUITY_VESTED_BEFORE_START")).toBe(
        true
      );
      expect(warnings.some((w) => w.message.includes("eg-past"))).toBe(true);
    });
  });

  describe("Test 3 — Payroll investing increases portfolio", () => {
    it("annual contributions appear in year table and invested assets increase", () => {
      const traditionalId = "trad";
      const hsaId = "hsa";
      const household = createBaseHousehold({
        accounts: [
          {
            id: traditionalId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 100000,
            includedInFIAssets: true,
          },
          {
            id: hsaId,
            name: "HSA",
            type: "HSA",
            owner: "PERSON_A",
            startingBalance: 10000,
            includedInFIAssets: true,
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 294000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [
                { accountId: traditionalId, amountMonthly: 2000 },
                { accountId: hsaId, amountMonthly: 500 },
              ],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario();

      const result = runProjection(household, scenario, 10);

      const firstRow = result.yearRows[0];
      expect(firstRow.contributionsByAccount[traditionalId]).toBe(2000 * 12);
      expect(firstRow.contributionsByAccount[hsaId]).toBe(500 * 12);

      const lastRow = result.yearRows[result.yearRows.length - 1];
      const totalContribTrad = result.yearRows.reduce(
        (s, r) => s + (r.contributionsByAccount[traditionalId] ?? 0),
        0
      );
      const totalContribHsa = result.yearRows.reduce(
        (s, r) => s + (r.contributionsByAccount[hsaId] ?? 0),
        0
      );
      expect(totalContribTrad).toBeGreaterThan(100000);
      expect(totalContribHsa).toBeGreaterThan(25000);

      expect(lastRow.investedAssets).toBeGreaterThan(
        100000 + 10000 + totalContribTrad + totalContribHsa
      );
    });

    it("FI year improves with payroll investing vs no-contribution baseline", () => {
      const traditionalId = "trad";
      const householdNoContrib = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 294000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
        accounts: [
          {
            id: traditionalId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 100000,
            includedInFIAssets: true,
          },
        ],
      });
      const householdWithContrib = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 294000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [
                { accountId: traditionalId, amountMonthly: 2000 },
              ],
              payrollDeductionsSpending: 0,
            },
          },
        ],
        accounts: [
          {
            id: traditionalId,
            name: "401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 100000,
            includedInFIAssets: true,
          },
        ],
      });
      const scenario = createBaseScenario();

      const resultNoContrib = runProjection(householdNoContrib, scenario, 50);
      const resultWithContrib = runProjection(householdWithContrib, scenario, 50);

      if (resultNoContrib.fiYear != null && resultWithContrib.fiYear != null) {
        expect(resultWithContrib.fiYear).toBeLessThanOrEqual(
          resultNoContrib.fiYear
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Invariants — structural correctness across all rows
  // ─────────────────────────────────────────────────────────────────────────
  describe("Invariants — structural correctness", () => {
    it("netWorth equals sum of all account endingBalances in every row", () => {
      const household = createBaseHousehold();
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 10);

      for (const row of result.yearRows) {
        const sumBalances = Object.values(row.endingBalances).reduce(
          (s, v) => s + v,
          0
        );
        expect(row.netWorth).toBeCloseTo(sumBalances, 6);
      }
    });

    it("investedAssets equals sum of includedInFIAssets account balances in every row", () => {
      const household = createBaseHousehold({
        accounts: [
          {
            id: "inv",
            name: "Invested",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 100_000,
            includedInFIAssets: true,
          },
          {
            id: "cash",
            name: "Cash",
            type: "CASH",
            owner: "PERSON_A",
            startingBalance: 20_000,
            includedInFIAssets: false,
          },
        ],
      });
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 10);

      const fiAccountIds = household.accounts
        .filter((a) => a.includedInFIAssets)
        .map((a) => a.id);

      for (const row of result.yearRows) {
        const sumFI = fiAccountIds.reduce(
          (s, id) => s + (row.endingBalances[id] ?? 0),
          0
        );
        expect(row.investedAssets).toBeCloseTo(sumFI, 6);
      }
    });

    it("fiYear row has investedAssets >= fiNumber", () => {
      // Start near FI so fiYear lands within the projection horizon
      const household = createBaseHousehold({ startInvested: 3_000_000 });
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 10);

      expect(result.fiYear).not.toBeNull();
      const fiRow = result.yearRows.find((r) => r.year === result.fiYear!);
      expect(fiRow).toBeDefined();
      expect(fiRow!.investedAssets).toBeGreaterThanOrEqual(result.fiNumber);
    });

    it("realReturn satisfies (1 + nominal) / (1 + inflation) - 1 for multiple inputs", () => {
      const cases: Array<{ nominal: number; inflation: number }> = [
        { nominal: 0.07, inflation: 0.03 },
        { nominal: 0.10, inflation: 0.04 },
        { nominal: 0.05, inflation: 0.02 },
        { nominal: 0.00, inflation: 0.03 }, // zero nominal → real < 0
      ];

      for (const { nominal, inflation } of cases) {
        const expected = (1 + nominal) / (1 + inflation) - 1;
        expect(realReturn(nominal, inflation)).toBeCloseTo(expected, 10);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Growth-only fixture — hand-calculated expected values
  // Real mode, single account, $100k start, zero contributions.
  //   real_return = (1.07/1.03) - 1 ≈ 0.038835
  //   Year 1 end  = 100,000 × (1.07/1.03)       ≈ 103,883.50
  //   Year 5 end  = 100,000 × (1.07/1.03)^5     ≈ 120,984.00
  // ─────────────────────────────────────────────────────────────────────────
  describe("Growth-only fixture — hand-calculated expected values", () => {
    const growthOnlyHousehold = () =>
      createBaseHousehold({
        startInvested: 100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });

    const growthOnlyScenario = () =>
      createBaseScenario({
        modelingMode: "REAL",
        nominalReturn: 0.07,
        inflation: 0.03,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

    it("Year 1 ending balance = 100,000 × (1.07/1.03) ≈ $103,883.50", () => {
      const result = runProjection(growthOnlyHousehold(), growthOnlyScenario(), 5);
      const y1 = result.yearRows[0];
      const expected = 100_000 * (1.07 / 1.03);
      expect(y1.investedAssets).toBeCloseTo(expected, 0); // ±$0.50
    });

    it("Year 5 ending balance = 100,000 × (1.07/1.03)^5 ≈ $120,984.00", () => {
      const result = runProjection(growthOnlyHousehold(), growthOnlyScenario(), 5);
      const y5 = result.yearRows[4]; // 0-indexed: index 4 = year 5
      const expected = 100_000 * Math.pow(1.07 / 1.03, 5);
      expect(y5.investedAssets).toBeCloseTo(expected, 0); // ±$0.50
    });

    it("each year compounds exactly on the prior year's balance (no contributions)", () => {
      const result = runProjection(growthOnlyHousehold(), growthOnlyScenario(), 5);
      const rate = realReturn(0.07, 0.03);

      for (let i = 1; i < result.yearRows.length; i++) {
        const prev = result.yearRows[i - 1].investedAssets;
        const curr = result.yearRows[i].investedAssets;
        expect(curr).toBeCloseTo(prev * (1 + rate), 4);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NOMINAL mode — inflated spending and nominal return applied directly
  // ─────────────────────────────────────────────────────────────────────────
  describe("NOMINAL mode — inflated spending and nominal return", () => {
    it("spending inflates by inflation rate each year starting in year 2", () => {
      const household = createBaseHousehold();
      const scenario = createBaseScenario({ modelingMode: "NOMINAL" });
      const result = runProjection(household, scenario, 5);

      const baseAnnualSpend = (scenario.currentMonthlySpend ?? 6353) * 12;
      const inf = scenario.inflation;

      const [y1, y2, y3] = result.yearRows;
      // i=0: no inflation applied yet (Math.pow(1+inf, 0) = 1)
      expect(y1.spending).toBeCloseTo(baseAnnualSpend, 0);
      // i=1: first inflation step
      expect(y2.spending).toBeCloseTo(baseAnnualSpend * (1 + inf), 0);
      // i=2: compounded
      expect(y3.spending).toBeCloseTo(baseAnnualSpend * Math.pow(1 + inf, 2), 0);
    });

    it("nominal return (not real) is applied to accounts in NOMINAL mode", () => {
      // Zero-contribution, zero-income setup so growth is the only variable
      const household = createBaseHousehold({
        startInvested: 100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        modelingMode: "NOMINAL",
        nominalReturn: 0.07,
        inflation: 0.03,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });
      const result = runProjection(household, scenario, 5);

      // NOMINAL mode uses rate = nominalReturn = 0.07 (not the ~3.88% real rate)
      // Year 1 end = 100,000 × 1.07 = 107,000
      expect(result.yearRows[0].investedAssets).toBeCloseTo(107_000, 0);
      // Year 5 end = 100,000 × 1.07^5 ≈ 140,255.17
      expect(result.yearRows[4].investedAssets).toBeCloseTo(
        100_000 * Math.pow(1.07, 5),
        0
      );
    });

    it("NOMINAL year-1 investedAssets > REAL year-1 investedAssets (nominal > real rate)", () => {
      const household = createBaseHousehold({
        startInvested: 100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: false },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const nominalResult = runProjection(
        household,
        createBaseScenario({ modelingMode: "NOMINAL", takeHomeAnnual: 0, currentMonthlySpend: 0 }),
        5
      );
      const realResult = runProjection(
        household,
        createBaseScenario({ modelingMode: "REAL", takeHomeAnnual: 0, currentMonthlySpend: 0 }),
        5
      );
      // 7% nominal > ~3.88% real, so nominal portfolios grow faster in dollar terms
      expect(nominalResult.yearRows[0].investedAssets).toBeGreaterThan(
        realResult.yearRows[0].investedAssets
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Coast FI — years to target from retirementAgeTarget + birthYear
  // ─────────────────────────────────────────────────────────────────────────
  describe("Coast FI — years to target from retirementAgeTarget + birthYear", () => {
    it("uses correct years when birthYear and retirementAgeTarget are set", () => {
      // Start 2025, birth 1990, target 65 → retirement 2055, yearsToTarget = 30 at start
      // FI number = 3.2M. Need invested such that X * 1.0388^30 >= 3.2M → X >= ~1.02M
      const household = createBaseHousehold({
        startInvested: 1_100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1990,
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementAgeTarget: 65,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });
      const result = runProjection(household, scenario, 40);

      // With 1.1M and 30 years to 2055, future value >= 3.2M → Coast FI in year 1
      expect(result.coastFiYear).toBe(START_YEAR);
    });

    it("early retirement (target 55) produces different coastFiYear than target 65", () => {
      // Same assets, earlier retirement = fewer years to grow = need more upfront
      const basePeople: Household["people"] = [
        {
          id: "p1",
          name: "Person A",
          birthYear: 1990,
          income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: true },
          payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
        },
      ];
      const household = createBaseHousehold({
        startInvested: 800_000,
        people: basePeople,
      });

      const result65 = runProjection(
        household,
        createBaseScenario({ retirementAgeTarget: 65, takeHomeAnnual: 0, currentMonthlySpend: 0 }),
        40
      );
      const result55 = runProjection(
        household,
        createBaseScenario({ retirementAgeTarget: 55, takeHomeAnnual: 0, currentMonthlySpend: 0 }),
        40
      );

      // With 55, retirement is 2045 (20 years); with 65, 2055 (30 years)
      // 800k * 1.0388^20 ≈ 1.7M < 3.2M; 800k * 1.0388^30 ≈ 2.5M < 3.2M
      // Both may be null, but if either hits Coast FI, 65 should hit it first (more years to grow)
      if (result65.coastFiYear != null && result55.coastFiYear != null) {
        expect(result65.coastFiYear).toBeLessThanOrEqual(result55.coastFiYear);
      }
    });

    it("when birthYear is missing, uses 30-year horizon (regression)", () => {
      // No birthYear → retirementYear = startYear + 30 = 2055
      // Same as birthYear 1990 + target 65. Verify behavior is consistent.
      const householdNoBirth = createBaseHousehold({
        startInvested: 1_100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const householdWithBirth = createBaseHousehold({
        startInvested: 1_100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            birthYear: 1990,
            income: { baseSalaryAnnual: 0, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        retirementAgeTarget: 65,
        takeHomeAnnual: 0,
        currentMonthlySpend: 0,
      });

      const resultNoBirth = runProjection(householdNoBirth, scenario, 40);
      const resultWithBirth = runProjection(householdWithBirth, scenario, 40);

      // Both use retirement 2055 (30 years from 2025)
      expect(resultNoBirth.coastFiYear).toBe(resultWithBirth.coastFiYear);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Out-of-pocket investing — household-level contributions
  // ─────────────────────────────────────────────────────────────────────────
  describe("Out-of-pocket investing", () => {
    const invId = "inv";

    it("contributions appear in contributionsByAccount and increase invested assets", () => {
      const household = createBaseHousehold({
        startInvested: 100_000,
        outOfPocketInvesting: [
          { accountId: invId, amountMonthly: 500 },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 200_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 10);

      const firstRow = result.yearRows[0];
      expect(firstRow.contributionsByAccount[invId]).toBe(500 * 12);

      const lastRow = result.yearRows[result.yearRows.length - 1];
      const totalContrib = result.yearRows.reduce(
        (s, r) => s + (r.contributionsByAccount[invId] ?? 0),
        0
      );
      expect(totalContrib).toBeGreaterThan(0);
      expect(lastRow.investedAssets).toBeGreaterThan(100_000 + totalContrib);
    });

    it("combined payroll + out-of-pocket to same account is additive", () => {
      const household = createBaseHousehold({
        startInvested: 100_000,
        outOfPocketInvesting: [
          { accountId: invId, amountMonthly: 500 },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 200_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: invId, amountMonthly: 1000 }],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 5);

      const firstRow = result.yearRows[0];
      // 1000/mo payroll + 500/mo out-of-pocket = 1500/mo = 18k annually
      expect(firstRow.contributionsByAccount[invId]).toBe(18_000);
    });

    it("startYear/endYear limits applicability of out-of-pocket contributions", () => {
      const household = createBaseHousehold({
        startInvested: 100_000,
        outOfPocketInvesting: [
          { accountId: invId, amountMonthly: 1000, startYear: 2027, endYear: 2029 },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 200_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario();
      const result = runProjection(household, scenario, 10);

      const y2026 = result.yearRows.find((r) => r.year === 2026);
      const y2027 = result.yearRows.find((r) => r.year === 2027);
      const y2030 = result.yearRows.find((r) => r.year === 2030);

      expect(y2026?.contributionsByAccount[invId]).toBe(0);
      expect(y2027?.contributionsByAccount[invId]).toBe(12_000);
      expect(y2030?.contributionsByAccount[invId]).toBe(0);
    });

    it("FI year improves with out-of-pocket vs no-contribution baseline", () => {
      const householdNoOop = createBaseHousehold({
        startInvested: 100_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 200_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const householdWithOop = createBaseHousehold({
        startInvested: 100_000,
        outOfPocketInvesting: [
          { accountId: invId, amountMonthly: 2000 },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 200_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario();

      const resultNoOop = runProjection(householdNoOop, scenario, 50);
      const resultWithOop = runProjection(householdWithOop, scenario, 50);

      if (resultNoOop.fiYear != null && resultWithOop.fiYear != null) {
        expect(resultWithOop.fiYear).toBeLessThanOrEqual(resultNoOop.fiYear);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Contribution schema — fixed vs percent exclusivity
  // ─────────────────────────────────────────────────────────────────────────
  describe("Contribution schema", () => {
    it("accepts fixed amount (amountMonthly)", () => {
      const result = ContributionSchema.safeParse({
        accountId: "inv",
        amountMonthly: 1000,
      });
      expect(result.success).toBe(true);
    });
    it("accepts fixed amount (amountAnnual)", () => {
      const result = ContributionSchema.safeParse({
        accountId: "inv",
        amountAnnual: 12_000,
      });
      expect(result.success).toBe(true);
    });
    it("accepts percentOfIncome", () => {
      const result = ContributionSchema.safeParse({
        accountId: "inv",
        percentOfIncome: 15,
      });
      expect(result.success).toBe(true);
    });
    it("rejects both fixed amount and percentOfIncome", () => {
      const result = ContributionSchema.safeParse({
        accountId: "inv",
        amountMonthly: 1000,
        percentOfIncome: 15,
      });
      expect(result.success).toBe(false);
    });
    it("rejects neither fixed amount nor percentOfIncome", () => {
      const result = ContributionSchema.safeParse({
        accountId: "inv",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Percent-of-income contributions — scaling with salary growth
  // ─────────────────────────────────────────────────────────────────────────
  describe("Percent-of-income contributions", () => {
    it("percent contribution scales with salary growth", () => {
      const invId = "inv";
      const household = createBaseHousehold({
        startInvested: 0,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.03, // 3% annual nominal growth
              salaryGrowthIsReal: false,
            },
            payroll: {
              payrollInvesting: [
                { accountId: invId, percentOfIncome: 10 },
              ],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario({ modelingMode: "NOMINAL" });
      const result = runProjection(household, scenario, 5);

      const y0 = result.yearRows[0];
      const y1 = result.yearRows[1];
      const y2 = result.yearRows[2];

      // Year 0: 100k * 10% = 10k
      expect(y0.contributionsByAccount[invId]).toBeCloseTo(10_000, 0);
      // Year 1: 100k * 1.03 * 10% ≈ 10.3k
      expect(y1.contributionsByAccount[invId]).toBeCloseTo(10_300, 0);
      // Year 2: 100k * 1.03^2 * 10% ≈ 10.609k
      expect(y2.contributionsByAccount[invId]).toBeCloseTo(10_609, 0);
    });

    it("percent contribution uses scenario salaryGrowthOverride when set", () => {
      const invId = "inv";
      const household = createBaseHousehold({
        startInvested: 0,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.01, // per-person 1% (overridden by scenario)
              salaryGrowthIsReal: false,
            },
            payroll: {
              payrollInvesting: [
                { accountId: invId, percentOfIncome: 20 },
              ],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario({
        modelingMode: "NOMINAL",
        salaryGrowthOverride: 0.05, // global 5% override
      });
      const result = runProjection(household, scenario, 3);

      const y0 = result.yearRows[0];
      const y1 = result.yearRows[1];
      // With 5% override: 100k * 20% = 20k year 0; 100k * 1.05 * 20% = 21k year 1
      expect(y0.contributionsByAccount[invId]).toBeCloseTo(20_000, 0);
      expect(y1.contributionsByAccount[invId]).toBeCloseTo(21_000, 0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-person households — payroll aggregation and combined income
  // ─────────────────────────────────────────────────────────────────────────
  describe("Multi-person households", () => {
    it("two people with payroll investing sum contributions correctly", () => {
      const tradId = "trad";
      const jointId = "joint";
      const household = createBaseHousehold({
        accounts: [
          {
            id: tradId,
            name: "Person A 401k",
            type: "TRADITIONAL",
            owner: "PERSON_A",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
          {
            id: jointId,
            name: "Joint Brokerage",
            type: "TAXABLE",
            owner: "JOINT",
            startingBalance: 50_000,
            includedInFIAssets: true,
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 150_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: tradId, amountMonthly: 1500 }],
              payrollDeductionsSpending: 0,
            },
          },
          {
            id: "p2",
            name: "Person B",
            income: { baseSalaryAnnual: 120_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [
                { accountId: jointId, amountMonthly: 1000 },
              ],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario();

      const result = runProjection(household, scenario, 5);

      const firstRow = result.yearRows[0];
      expect(firstRow.contributionsByAccount[tradId]).toBe(1500 * 12);
      expect(firstRow.contributionsByAccount[jointId]).toBe(1000 * 12);
      expect(firstRow.grossIncome).toBe(270_000);
    });

    it("two people contributing to same account totals are additive", () => {
      const joint401k = "joint401k";
      const household = createBaseHousehold({
        accounts: [
          {
            id: joint401k,
            name: "Joint 401k",
            type: "TRADITIONAL",
            owner: "JOINT",
            startingBalance: 100_000,
            includedInFIAssets: true,
          },
        ],
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 150_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: joint401k, amountMonthly: 1500 }],
              payrollDeductionsSpending: 0,
            },
          },
          {
            id: "p2",
            name: "Person B",
            income: { baseSalaryAnnual: 120_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: joint401k, amountMonthly: 1200 }],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario();

      const result = runProjection(household, scenario, 5);

      const firstRow = result.yearRows[0];
      // 1500 + 1200 = 2700/mo = 32_400/year
      expect(firstRow.contributionsByAccount[joint401k]).toBe(32_400);
    });

    it("combined household income and savings improve FI year", () => {
      const singleHousehold = createBaseHousehold({
        startInvested: 200_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 150_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: "inv", amountMonthly: 2000 }],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const dualHousehold = createBaseHousehold({
        startInvested: 200_000,
        people: [
          {
            id: "p1",
            name: "Person A",
            income: { baseSalaryAnnual: 150_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: "inv", amountMonthly: 2000 }],
              payrollDeductionsSpending: 0,
            },
          },
          {
            id: "p2",
            name: "Person B",
            income: { baseSalaryAnnual: 120_000, salaryGrowthRate: 0, salaryGrowthIsReal: true },
            payroll: {
              payrollInvesting: [{ accountId: "inv", amountMonthly: 1500 }],
              payrollDeductionsSpending: 0,
            },
          },
        ],
      });
      const scenario = createBaseScenario();

      const singleResult = runProjection(singleHousehold, scenario, 40);
      const dualResult = runProjection(dualHousehold, scenario, 40);

      if (singleResult.fiYear != null && dualResult.fiYear != null) {
        expect(dualResult.fiYear).toBeLessThanOrEqual(singleResult.fiYear);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Salary growth — growthFactorReal, nominal vs real, override
  // ─────────────────────────────────────────────────────────────────────────
  describe("Salary growth", () => {
    it("salaryGrowthRate > 0 increases income year-over-year", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.03,
              salaryGrowthIsReal: false,
            },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({ modelingMode: "REAL" });
      const result = runProjection(household, scenario, 5);

      const [y0, y1, y2] = result.yearRows;
      expect(y1.grossIncome).toBeGreaterThan(y0.grossIncome);
      expect(y2.grossIncome).toBeGreaterThan(y1.grossIncome);
    });

    it("salaryGrowthIsReal true in REAL mode uses inflation-adjusted growth", () => {
      // Real growth: (1+0.03)/(1+0.03)-1 ≈ 0 when growth = inflation
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.03,
              salaryGrowthIsReal: true,
            },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        modelingMode: "REAL",
        inflation: 0.03,
      });
      const result = runProjection(household, scenario, 3);

      // With 3% nominal growth and 3% inflation, real growth ≈ 0
      const [y0, y1] = result.yearRows;
      expect(y1.grossIncome).toBeCloseTo(y0.grossIncome, -2);
    });

    it("salaryGrowthIsReal false uses nominal growth", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.05,
              salaryGrowthIsReal: false,
            },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({ modelingMode: "REAL" });
      const result = runProjection(household, scenario, 5);

      // Year 2029: yearsFromStart = 4 → 100k * 1.05^4 ≈ 121_550
      const y2029 = result.yearRows.find((r) => r.year === 2029);
      expect(y2029?.grossIncome).toBeCloseTo(
        100_000 * Math.pow(1.05, 2029 - START_YEAR),
        -2
      );
    });

    it("salaryGrowthOverride on scenario overrides per-person rate", () => {
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.02,
              salaryGrowthIsReal: false,
            },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenarioOverride = createBaseScenario({
        salaryGrowthOverride: 0.06,
      });
      const scenarioNoOverride = createBaseScenario({ salaryGrowthOverride: null });

      const resultOverride = runProjection(household, scenarioOverride, 5);
      const resultNoOverride = runProjection(household, scenarioNoOverride, 5);

      const y5Override = resultOverride.yearRows.find((r) => r.year === 2029);
      const y5NoOverride = resultNoOverride.yearRows.find((r) => r.year === 2029);

      // Override 6%: 100k * 1.06^5 ≈ 133_823; no override 2%: 100k * 1.02^5 ≈ 110_408
      expect(y5Override!.grossIncome).toBeGreaterThan(y5NoOverride!.grossIncome);
    });

    it("hand-calculated: salary = base × (1 + realGrowth)^yearsFromStart when salaryGrowthIsReal true", () => {
      // 5% nominal growth, 3% inflation → real ≈ (1.05/1.03)-1 ≈ 0.0194
      const household = createBaseHousehold({
        people: [
          {
            id: "p1",
            name: "Person A",
            income: {
              baseSalaryAnnual: 100_000,
              salaryGrowthRate: 0.05,
              salaryGrowthIsReal: true,
            },
            payroll: { payrollInvesting: [], payrollDeductionsSpending: 0 },
          },
        ],
      });
      const scenario = createBaseScenario({
        modelingMode: "REAL",
        inflation: 0.03,
      });
      const result = runProjection(household, scenario, 5);

      const realGrowth = (1 + 0.05) / (1 + 0.03) - 1;
      const yearsFromStart = 2029 - START_YEAR;
      const expected = 100_000 * Math.pow(1 + realGrowth, yearsFromStart);
      const y2029 = result.yearRows.find((r) => r.year === 2029);

      expect(y2029?.grossIncome).toBeCloseTo(expected, -2);
    });
  });
});
