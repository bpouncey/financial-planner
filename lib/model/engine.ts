/**
 * FI/RE planning calculation engine.
 * Per MODEL_RULES: annual projection, mid-year growth, FI/Coast FI, tax modes.
 */

import type {
  Household,
  Scenario,
  Contribution,
  PriceAssumption,
  Account,
  Person,
} from "@/lib/types/zod";
import {
  PENALTY_FREE_AGE_TRADITIONAL,
  PENALTY_FREE_AGE_HSA,
} from "@/lib/model/constants";

/** Normalize contribution to annual amount (fixed amounts only; use percent path for percentOfIncome). */
function toAnnual(c: Contribution): number {
  if (c.percentOfIncome != null) return 0;
  if (c.amountAnnual != null) return c.amountAnnual;
  if (c.amountMonthly != null) return c.amountMonthly * 12;
  return 0;
}

/** Check if contribution applies in year */
function appliesInYear(c: Contribution, year: number): boolean {
  const start = c.startYear ?? -Infinity;
  const end = c.endYear ?? Infinity;
  return year >= start && year <= end;
}

/** Get share price for a grant in a given year from price assumption */
function sharePriceForYear(
  priceAssumption: PriceAssumption,
  year: number,
  startYear: number
): number {
  const fixedPrice = priceAssumption.fixedPrice ?? 0;
  if (priceAssumption.mode === "FIXED") return fixedPrice;
  const growthRate = priceAssumption.growthRate ?? 0;
  return fixedPrice * Math.pow(1 + growthRate, year - startYear);
}

/** Return accounts ordered for withdrawal (by scenario.withdrawalOrder) */
function getAccountsInWithdrawalOrder(
  accounts: Account[],
  withdrawalOrder: string[]
): Account[] {
  const byType = new Map<string, Account[]>();
  for (const a of accounts) {
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }
  const result: Account[] = [];
  for (const type of withdrawalOrder) {
    const list = byType.get(type) ?? [];
    result.push(...list);
  }
  return result;
}

/** Account types that are taxable on withdrawal and restricted until 59.5+ */
function isPreTaxRetirement(type: string): boolean {
  return type === "TRADITIONAL" || type === "403B";
}

function getAccessibleAccountTypes(year: number, people: Person[]): Set<string> {
  const accessible = new Set<string>(["CASH", "TAXABLE", "MONEY_MARKET", "ROTH"]);
  const oldestAge = people.reduce((max, p) => {
    const by = p.birthYear;
    return by != null ? Math.max(max, year - by) : max;
  }, -1);
  if (oldestAge < 0)
    return new Set(["CASH", "TAXABLE", "MONEY_MARKET", "TRADITIONAL", "403B", "ROTH", "HSA"]);
  if (oldestAge >= PENALTY_FREE_AGE_TRADITIONAL) {
    accessible.add("TRADITIONAL");
    accessible.add("403B");
  }
  if (oldestAge >= PENALTY_FREE_AGE_HSA) accessible.add("HSA");
  return accessible;
}

/** Get net RSU vest proceeds by account for a given year */
function getRsuVestProceeds(
  household: Household,
  year: number
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const grant of household.equityGrants ?? []) {
    const entry = grant.vestingTable?.find((e) => e.year === year);
    if (!entry || entry.shares <= 0) continue;

    const price = sharePriceForYear(
      grant.priceAssumption,
      year,
      grant.startYear
    );
    const vestedValue = entry.shares * price;
    const withholding = vestedValue * grant.withholdingRate;
    const netProceeds = vestedValue - withholding;

    const destId = grant.destinationAccountId;
    if (!destId) continue;
    out[destId] = (out[destId] ?? 0) + netProceeds;
  }
  return out;
}

export interface YearRow {
  year: number;
  grossIncome: number;
  taxes: number;
  spending: number;
  netCashSurplus: number;
  contributionsByAccount: Record<string, number>;
  growthByAccount: Record<string, number>;
  endingBalances: Record<string, number>;
  investedAssets: number;
  netWorth: number;
  /** Per-account withdrawal amounts in withdrawal phase. */
  withdrawalByAccount?: Record<string, number>;
  /** When withdrawal phase but accessible funds insufficient. */
  withdrawalShortfall?: number;
  /** Accumulation (saving) vs withdrawal (spending) phase. */
  phase?: "accumulation" | "withdrawal";
  /** Taxes on Traditional account withdrawals in withdrawal phase. */
  withdrawalPhaseTaxes?: number;
}

export interface ProjectionResult {
  yearRows: YearRow[];
  fiNumber: number;
  fiYear: number | null;
  coastFiYear: number | null;
  savingsRate: number;
}

/**
 * Compute real return from nominal and inflation.
 * real ≈ (1 + nominal) / (1 + inflation) - 1
 */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Options for runProjection (internal use for Monte Carlo). */
export interface ProjectionOptions {
  /** Override return rate per year index; when set, used instead of scenario rate. */
  annualRates?: number[];
}

/**
 * Run annual projection for household + scenario.
 * Mid-year growth: growth on (Begin + 0.5 * Contributions) per MODEL_RULES §5.
 */
export function runProjection(
  household: Household,
  scenario: Scenario,
  horizonYears: number = 50,
  options?: ProjectionOptions
): ProjectionResult {
  const startYear = household.startYear;
  const people = household.people;

  const nominalReturn = scenario.nominalReturn;
  const inflation = scenario.inflation;
  const isReal = scenario.modelingMode === "REAL";
  const rate = isReal ? realReturn(nominalReturn, inflation) : nominalReturn;

  const annualRetirementSpend =
    scenario.retirementMonthlySpend * 12;
  const fiNumber = annualRetirementSpend / scenario.swr;

  // Per-person gross income (salary growth, bonus) for percent-of-income contributions
  const getPersonGrossIncome = (person: Person, year: number): number => {
    const yearsFromStart = year - startYear;
    const growthOverride = scenario.salaryGrowthOverride;
    const salaryGrowth =
      growthOverride ?? person.income.salaryGrowthRate ?? 0;
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

  // Payroll investing: Person payrollInvesting -> accountId (fixed or percent-of-income)
  const getPayrollContributions = (year: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const person of people) {
      for (const c of person.payroll.payrollInvesting) {
        if (!appliesInYear(c, year)) continue;
        const amt =
          c.percentOfIncome != null
            ? getPersonGrossIncome(person, year) * (c.percentOfIncome / 100)
            : toAnnual(c);
        out[c.accountId] = (out[c.accountId] ?? 0) + amt;
      }
    }
    return out;
  };

  // Out-of-pocket investing: household-level contributions by account
  const getOutOfPocketContributions = (year: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of household.outOfPocketInvesting ?? []) {
      if (!appliesInYear(c, year)) continue;
      const amt = toAnnual(c);
      out[c.accountId] = (out[c.accountId] ?? 0) + amt;
    }
    return out;
  };

  // Monthly savings: household-level contributions by account (e.g. emergency fund, HYSA)
  const getMonthlySavingsContributions = (year: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of household.monthlySavings ?? []) {
      if (!appliesInYear(c, year)) continue;
      const amt = toAnnual(c);
      out[c.accountId] = (out[c.accountId] ?? 0) + amt;
    }
    return out;
  };

  // Gross income: sum of person incomes with salary growth
  const getGrossIncome = (year: number): number => {
    let total = 0;
    const yearsFromStart = year - startYear;
    const growthOverride = scenario.salaryGrowthOverride;
    for (const person of people) {
      const salaryGrowth =
        growthOverride ?? person.income.salaryGrowthRate ?? 0;
      const growthFactor =
        person.income.salaryGrowthIsReal && isReal
          ? Math.pow(1 + growthFactorReal(salaryGrowth, inflation), yearsFromStart)
          : Math.pow(1 + salaryGrowth, yearsFromStart);
      total += person.income.baseSalaryAnnual * growthFactor;
      if (person.income.bonusAnnual) total += person.income.bonusAnnual;
      if (person.income.bonusPercent)
        total += person.income.baseSalaryAnnual * (person.income.bonusPercent / 100);
    }
    return total;
  };

  // Mode B: take-home provided; taxes implicit
  const takeHome = scenario.takeHomeAnnual;
  const effectiveRate = scenario.effectiveTaxRate;

  const getTakeHomeAndTaxes = (
    gross: number
  ): { takeHome: number; taxes: number } => {
    if (takeHome != null) {
      return { takeHome, taxes: gross - takeHome };
    }
    if (effectiveRate != null) {
      const taxes = gross * effectiveRate;
      return { takeHome: gross - taxes, taxes };
    }
    // Fallback: assume no taxes
    return { takeHome: gross, taxes: 0 };
  };

  const currentMonthlySpend = scenario.currentMonthlySpend ?? 6353;
  const payrollDeductions = people.reduce(
    (s, p) => s + (p.payroll.payrollDeductionsSpending ?? 0),
    0
  );
  const currentAnnualSpend = currentMonthlySpend * 12 + payrollDeductions;

  const yearRows: YearRow[] = [];
  let balances: Record<string, number> = {};
  for (const a of household.accounts) {
    balances[a.id] = a.startingBalance;
  }

  let fiYear: number | null = null;
  let coastFiYear: number | null = null;
  let firstYearIncome = 0;
  let firstYearSaving = 0;

  const withdrawalOrder =
    scenario.withdrawalOrder ?? ["TAXABLE", "MONEY_MARKET", "TRADITIONAL", "403B", "ROTH"];
  const orderedAccounts = getAccountsInWithdrawalOrder(
    household.accounts,
    withdrawalOrder
  );

  for (let i = 0; i < horizonYears; i++) {
    const year = startYear + i;

    // Determine if we're in withdrawal phase (retired)
    const inWithdrawal =
      (scenario.retirementStartYear != null &&
        year >= scenario.retirementStartYear) ||
      (fiYear != null && year > fiYear);

    // Apply one-time events for this year (before contributions and growth)
    for (const event of household.events ?? []) {
      if (event.year !== year) continue;
      const accountId =
        event.accountId ??
        household.accounts.find((a) => a.type === "CASH")?.id;
      if (!accountId) continue;

      if (event.kind === "OUTFLOW") {
        const current = balances[accountId] ?? 0;
        balances[accountId] = Math.max(0, current - event.amount);
      } else {
        balances[accountId] = (balances[accountId] ?? 0) + event.amount;
      }
    }

    let gross: number;
    let taxes: number;
    let spending: number;
    let netCashSurplus: number;
    const contributionsByAccount: Record<string, number> = {};
    const withdrawalByAccount: Record<string, number> = {};
    let withdrawalShortfall: number | undefined;

    if (inWithdrawal) {
      // Withdrawal phase: no income, withdraw from accounts to fund spending
      gross = 0;
      spending = annualRetirementSpend;
      netCashSurplus = -spending;
      for (const a of household.accounts) {
        contributionsByAccount[a.id] = 0;
      }

      // Withdraw from accounts in order until annual spend is met
      const accessibleTypes = getAccessibleAccountTypes(year, people);
      const accessibleAccounts = orderedAccounts.filter((a) =>
        accessibleTypes.has(a.type)
      );
      let remainingToWithdraw = annualRetirementSpend;
      const preGrowthBalances = { ...balances };
      for (const a of accessibleAccounts) {
        if (remainingToWithdraw <= 0) break;
        const available = preGrowthBalances[a.id] ?? 0;
        const withdraw = Math.min(available, remainingToWithdraw);
        if (withdraw > 0) {
          withdrawalByAccount[a.id] = withdraw;
          preGrowthBalances[a.id] = available - withdraw;
          remainingToWithdraw -= withdraw;
        }
      }
      balances = preGrowthBalances;

      const totalWithdrawn = Object.values(withdrawalByAccount).reduce(
        (s, v) => s + v,
        0
      );
      const shortfall = annualRetirementSpend - totalWithdrawn;
      if (shortfall > 0) withdrawalShortfall = shortfall;

      // Tax on Traditional account withdrawals (treated as taxable income)
      const accountById = new Map(household.accounts.map((a) => [a.id, a]));
      let taxableWithdrawal = 0;
      for (const [accountId, amount] of Object.entries(withdrawalByAccount)) {
        const acct = accountById.get(accountId);
        if (acct && isPreTaxRetirement(acct.type)) taxableWithdrawal += amount;
      }
      const retirementRate = scenario.retirementEffectiveTaxRate ?? 0;
      taxes = taxableWithdrawal * retirementRate;
    } else {
      // Accumulation phase: income, taxes, contributions, growth
      gross = getGrossIncome(year);
      if (i === 0) firstYearIncome = gross;

      const { takeHome: th, taxes: t } = getTakeHomeAndTaxes(gross);
      taxes = t;
      spending =
        scenario.modelingMode === "NOMINAL" && i > 0
          ? currentAnnualSpend * Math.pow(1 + inflation, i)
          : currentAnnualSpend;

      const payrollContrib = getPayrollContributions(year);
      let oopContrib = getOutOfPocketContributions(year);
      let savingsContrib = getMonthlySavingsContributions(year);
      const rsuProceeds = getRsuVestProceeds(household, year);

      // Stop funding emergency fund goal account once it reaches target
      const efGoal = household.emergencyFundGoal;
      if (
        efGoal?.targetAmount != null &&
        efGoal?.accountId != null &&
        (balances[efGoal.accountId] ?? 0) >= efGoal.targetAmount
      ) {
        oopContrib = { ...oopContrib, [efGoal.accountId]: 0 };
        savingsContrib = { ...savingsContrib, [efGoal.accountId]: 0 };
      }

      const totalOopContrib = Object.values(oopContrib).reduce(
        (s, v) => s + v,
        0
      );
      const totalSavingsContrib = Object.values(savingsContrib).reduce(
        (s, v) => s + v,
        0
      );

      netCashSurplus = th - spending - totalOopContrib - totalSavingsContrib;

      for (const a of household.accounts) {
        contributionsByAccount[a.id] =
          (payrollContrib[a.id] ?? 0) +
          (oopContrib[a.id] ?? 0) +
          (savingsContrib[a.id] ?? 0) +
          (rsuProceeds[a.id] ?? 0);
      }
    }

    const growthByAccount: Record<string, number> = {};
    const endingBalances: Record<string, number> = {};

    // Per-year rate override (Monte Carlo) or stress test for year 0
    const effectiveRate = (() => {
      const override = options?.annualRates?.[i];
      if (override != null) return override;
      if (i === 0 && scenario.stressTestFirstYearReturn != null)
        return scenario.stressTestFirstYearReturn;
      return rate;
    })();

    for (const a of household.accounts) {
      const begin = balances[a.id] ?? 0;
      const contrib = contributionsByAccount[a.id] ?? 0;
      const midYearBase = begin + 0.5 * contrib;
      // MONEY_MARKET with apy set: use account-specific rate (not scenario/investment rate)
      const accountRate =
        a.type === "MONEY_MARKET" && a.apy != null
          ? isReal
            ? realReturn(a.apy, inflation)
            : a.apy
          : effectiveRate;
      const growth = midYearBase * accountRate;
      const end = begin + contrib + growth;
      growthByAccount[a.id] = growth;
      endingBalances[a.id] = end;
    }

    balances = { ...endingBalances };

    let investedAssets = 0;
    let netWorth = 0;
    for (const a of household.accounts) {
      netWorth += endingBalances[a.id] ?? 0;
      if (a.includedInFIAssets) investedAssets += endingBalances[a.id] ?? 0;
    }

    if (fiYear == null && investedAssets >= fiNumber) fiYear = year;

    const phase: "accumulation" | "withdrawal" = inWithdrawal
      ? "withdrawal"
      : "accumulation";

    const row: YearRow = {
      year,
      grossIncome: gross,
      taxes,
      spending,
      netCashSurplus,
      contributionsByAccount: { ...contributionsByAccount },
      growthByAccount: { ...growthByAccount },
      endingBalances: { ...endingBalances },
      investedAssets,
      netWorth,
      phase,
    };
    if (Object.keys(withdrawalByAccount).length > 0) {
      row.withdrawalByAccount = withdrawalByAccount;
    }
    if (withdrawalShortfall != null && withdrawalShortfall > 0) {
      row.withdrawalShortfall = withdrawalShortfall;
    }
    if (phase === "withdrawal") {
      row.withdrawalPhaseTaxes = taxes;
    }
    yearRows.push(row);

    if (i === 0 && !inWithdrawal) {
      const payrollContrib = getPayrollContributions(year);
      const oopContrib = getOutOfPocketContributions(year);
      const savingsContrib = getMonthlySavingsContributions(year);
      firstYearSaving =
        Object.values(payrollContrib).reduce((s, v) => s + v, 0) +
        Object.values(oopContrib).reduce((s, v) => s + v, 0) +
        Object.values(savingsContrib).reduce((s, v) => s + v, 0);
    }
  }

  // Coast FI: currentInvested * (1+r)^n >= FI_Number for n = years to target
  const lastRow = yearRows[yearRows.length - 1];
  if (lastRow) {
    const firstPerson = people[0];
    const retirementYear =
      firstPerson?.birthYear != null
        ? firstPerson.birthYear + scenario.retirementAgeTarget
        : startYear + 30;
    for (let y = 0; y < yearRows.length; y++) {
      const row = yearRows[y];
      const yearsToTarget = Math.max(1, retirementYear - row.year);
      const futureVal =
        row.investedAssets * Math.pow(1 + rate, yearsToTarget);
      if (futureVal >= fiNumber) {
        coastFiYear = row.year;
        break;
      }
    }
  }

  const savingsRate =
    firstYearIncome > 0 ? firstYearSaving / firstYearIncome : 0;

  return {
    yearRows,
    fiNumber,
    fiYear,
    coastFiYear,
    savingsRate,
  };
}

/** Result of Monte Carlo simulation: FI year distribution. */
export interface MonteCarloResult {
  fiYear25: number | null;
  fiYear50: number | null;
  fiYear75: number | null;
  pathsRun: number;
  pathsHitFi: number;
}

/** Box-Muller transform: sample from standard normal N(0,1). */
function randomNormal(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  if (u1 <= 0) return 0;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Sample annual return from lognormal distribution.
 * E[1+R] ≈ 1 + meanReturn when volatility is moderate.
 */
function sampleLognormalReturn(meanReturn: number, volatility: number): number {
  const sigma = volatility;
  const mu = Math.log(1 + meanReturn) - (sigma * sigma) / 2;
  const z = randomNormal();
  const r = Math.exp(mu + sigma * z) - 1;
  return r;
}

/**
 * Run Monte Carlo simulation: many paths with random annual returns.
 * Returns FI year distribution (25th, 50th, 75th percentiles).
 */
export function runMonteCarlo(
  household: Household,
  scenario: Scenario,
  paths: number = 200,
  horizonYears: number = 50,
  returnVolatility: number = 0.15
): MonteCarloResult {
  const nominalReturn = scenario.nominalReturn;
  const inflation = scenario.inflation;
  const isReal = scenario.modelingMode === "REAL";
  const meanRate = isReal
    ? realReturn(nominalReturn, inflation)
    : nominalReturn;

  const fiYears: number[] = [];
  let pathsHitFi = 0;

  for (let p = 0; p < paths; p++) {
    const annualRates: number[] = [];
    for (let i = 0; i < horizonYears; i++) {
      annualRates.push(sampleLognormalReturn(meanRate, returnVolatility));
    }

    const result = runProjection(household, scenario, horizonYears, {
      annualRates,
    });

    const fiY = result.fiYear ?? household.startYear + horizonYears;
    fiYears.push(fiY);
    if (result.fiYear != null) pathsHitFi++;
  }

  fiYears.sort((a, b) => a - b);

  const p25 = percentile(fiYears, 25);
  const p50 = percentile(fiYears, 50);
  const p75 = percentile(fiYears, 75);

  return {
    fiYear25: p25,
    fiYear50: p50,
    fiYear75: p75,
    pathsRun: paths,
    pathsHitFi,
  };
}

/** Linear interpolation for percentiles (e.g. p=25 → 25th percentile). */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function growthFactorReal(nominalGrowth: number, inflation: number): number {
  return (1 + nominalGrowth) / (1 + inflation) - 1;
}
