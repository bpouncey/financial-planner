/**
 * FI/RE planning calculation engine.
 * Per MODEL_RULES: annual projection, mid-year growth, FI/Coast FI, tax modes.
 */

import type {
  Household,
  Scenario,
  Contribution,
  ContributionOverride,
  PriceAssumption,
  Account,
  Person,
} from "@/lib/types/zod";
import {
  PENALTY_FREE_AGE_TRADITIONAL,
  PENALTY_FREE_AGE_HSA,
  DEFAULT_TAXABLE_WITHDRAWAL_TAX_RATE,
} from "@/lib/model/constants";
import {
  capContributionsAtIRSLimits,
  getContributionsBreakdown,
} from "@/lib/model/contribution-limits";

/** Contribution-like shape with optional month bounds (Contribution or ContributionOverride). */
type ContributionLike = Pick<
  Contribution,
  "startYear" | "endYear" | "startMonth" | "endMonth" | "amountAnnual" | "amountMonthly" | "percentOfIncome"
>;

/** Number of months a contribution applies in a given year (0–12). Handles partial-year via startMonth/endMonth. */
export function getMonthsInYear(c: ContributionLike, year: number): number {
  const start = c.startYear ?? -Infinity;
  const end = c.endYear ?? Infinity;
  if (year < start || year > end) return 0;

  const startMonth = c.startMonth ?? 1;
  const endMonth = c.endMonth ?? 12;

  if (start === end) {
    return Math.max(0, endMonth - startMonth + 1);
  }
  if (year === start) {
    return 13 - startMonth;
  }
  if (year === end) {
    return endMonth;
  }
  return 12;
}

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

/**
 * Get prorated annual contribution for a year. For partial-year (startMonth/endMonth),
 * returns amountMonthly * months or amountAnnual * (months/12). For percentOfIncome, returns 0 (caller prorates).
 */
export function getProratedAnnualContribution(c: Contribution, year: number): number {
  if (c.percentOfIncome != null) return 0;
  const months = getMonthsInYear(c, year);
  if (months <= 0) return 0;
  if (months >= 12) return toAnnual(c);
  if (c.amountMonthly != null) return c.amountMonthly * months;
  if (c.amountAnnual != null) return c.amountAnnual * (months / 12);
  return 0;
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

/** Default bucket-based withdrawal order. ROTH bucket includes both ROTH_401K and ROTH_IRA. */
const DEFAULT_WITHDRAWAL_BUCKETS = ["TAXABLE", "TAX_DEFERRED", "ROTH"] as const;

/** Map account type to withdrawal bucket */
function getWithdrawalBucket(accountType: string): string | null {
  // TAXABLE bucket
  if (["TAXABLE", "MONEY_MARKET", "CASH", "CHECKING", "EMPLOYER_STOCK"].includes(accountType)) {
    return "TAXABLE";
  }
  // TAX_DEFERRED bucket
  if (["TRADITIONAL_401K", "TRADITIONAL_IRA", "403B", "HSA", "TRADITIONAL"].includes(accountType)) {
    return "TAX_DEFERRED";
  }
  // ROTH bucket
  if (["ROTH_401K", "ROTH_IRA", "ROTH"].includes(accountType)) {
    return "ROTH";
  }
  return null;
}

/** Return accounts ordered for withdrawal using bucket-based strategy.
 * Within each bucket, accounts are sorted per orderWithin using currentBalances. */
function getAccountsInWithdrawalOrderByBuckets(
  accounts: Account[],
  withdrawalOrderBuckets: string[],
  orderWithin: "SMALLEST_FIRST" | "LARGEST_FIRST" | "ACCOUNT_ORDER",
  currentBalances: Record<string, number>
): Account[] {
  // Group accounts by bucket
  const byBucket = new Map<string, Account[]>();
  for (const a of accounts) {
    const bucket = getWithdrawalBucket(a.type);
    if (!bucket) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push(a);
    byBucket.set(bucket, list);
  }

  const result: Account[] = [];
  for (const bucket of withdrawalOrderBuckets) {
    const list = [...(byBucket.get(bucket) ?? [])];
    if (orderWithin === "SMALLEST_FIRST") {
      list.sort((a, b) => (currentBalances[a.id] ?? 0) - (currentBalances[b.id] ?? 0));
    } else if (orderWithin === "LARGEST_FIRST") {
      list.sort((a, b) => (currentBalances[b.id] ?? 0) - (currentBalances[a.id] ?? 0));
    }
    // ACCOUNT_ORDER: no sort — preserve original order
    result.push(...list);
  }
  return result;
}

/** Account types that are taxable on withdrawal and restricted until 59.5+ */
function isPreTaxRetirement(type: string): boolean {
  return (
    type === "TRADITIONAL" ||
    type === "TRADITIONAL_401K" ||
    type === "TRADITIONAL_IRA" ||
    type === "403B" ||
    type === "HSA"
  );
}

/** Account types that are taxable brokerage / money market (withdrawals taxed as capital gains; MVP: 0 rate). */
function isTaxableBrokerage(type: string): boolean {
  return type === "TAXABLE" || type === "MONEY_MARKET";
}

/** Pre-tax employee account types (Traditional 401k, IRA, 403b, HSA). */
const PRE_TAX_ACCOUNT_TYPES = new Set([
  "TRADITIONAL_401K",
  "TRADITIONAL_IRA",
  "403B",
  "HSA",
]);

/** Roth employee account types. */
const ROTH_ACCOUNT_TYPES = new Set(["ROTH_401K", "ROTH_IRA"]);

/** Rounding threshold for cashflow reconciliation (1 cent). */
const RECONCILIATION_ROUNDING_THRESHOLD = 0.01;

/** Get payroll contribution split from capped contributions and breakdown. */
function getPayrollContributionsSplitFromCapped(
  household: Household,
  cappedByAccount: Record<string, number>,
  breakdown: Record<string, { employee: number; employer: number }>
): { employeePreTaxContribs: number; employeeRothContribs: number; employerContribs: number } {
  const accountById = new Map(household.accounts.map((a) => [a.id, a]));
  let employeePreTax = 0;
  let employeeRoth = 0;
  let employer = 0;
  for (const [accountId, b] of Object.entries(breakdown)) {
    const acct = accountById.get(accountId);
    const type = acct?.type ?? "";
    const total = cappedByAccount[accountId] ?? 0;
    const denom = b.employee + b.employer;
    const empShare = denom > 0 ? b.employee / denom : 0;
    const emplShare = denom > 0 ? b.employer / denom : 0;
    const empAmt = total * empShare;
    const emplAmt = total * emplShare;
    if (PRE_TAX_ACCOUNT_TYPES.has(type)) {
      employeePreTax += empAmt;
    } else if (ROTH_ACCOUNT_TYPES.has(type)) {
      employeeRoth += empAmt;
    }
    employer += emplAmt;
  }
  return {
    employeePreTaxContribs: employeePreTax,
    employeeRothContribs: employeeRoth,
    employerContribs: employer,
  };
}

function getAccessibleAccountTypes(year: number, people: Person[]): Set<string> {
  const accessible = new Set<string>([
    "CASH",
    "TAXABLE",
    "MONEY_MARKET",
    "ROTH",
    "ROTH_401K",
    "ROTH_IRA",
  ]);
  const oldestAge = people.reduce((max, p) => {
    const by = p.birthYear;
    return by != null ? Math.max(max, year - by) : max;
  }, -1);
  if (oldestAge < 0)
    return new Set([
      "CASH",
      "TAXABLE",
      "MONEY_MARKET",
      "TRADITIONAL",
      "TRADITIONAL_401K",
      "TRADITIONAL_IRA",
      "403B",
      "ROTH",
      "ROTH_401K",
      "ROTH_IRA",
      "HSA",
    ]);
  if (oldestAge >= PENALTY_FREE_AGE_TRADITIONAL) {
    accessible.add("TRADITIONAL");
    accessible.add("TRADITIONAL_401K");
    accessible.add("TRADITIONAL_IRA");
    accessible.add("403B");
  }
  if (oldestAge >= PENALTY_FREE_AGE_HSA) accessible.add("HSA");
  return accessible;
}

/** RSU vest breakdown: vestValue (W2 income), withholding, netProceeds, and by-account deposits. */
export interface RsuVestResult {
  vestValue: number;
  withholding: number;
  netProceeds: number;
  byAccount: Record<string, number>;
}

/** Resolve whether a grant is enabled for a scenario (base isEnabled + scenario override). */
function isGrantEnabledForScenario(
  grantId: string,
  grant: { isEnabled?: boolean },
  scenario: Scenario
): boolean {
  const override = scenario.equityGrantOverrides?.find((o) => o.grantId === grantId);
  if (override?.isEnabled === false) return false;
  if (override?.isEnabled === true) return true;
  return grant.isEnabled !== false;
}

/** Get RSU vest breakdown for a given year: vestValue (W2 income), withholding, netProceeds, deposits by account. */
function getRsuVestBreakdown(
  household: Household,
  year: number,
  scenario: Scenario
): RsuVestResult {
  let vestValue = 0;
  let withholding = 0;
  const byAccount: Record<string, number> = {};
  for (const grant of household.equityGrants ?? []) {
    if (!isGrantEnabledForScenario(grant.id, grant, scenario)) continue;

    const entry = grant.vestingTable?.find((e) => e.year === year);
    if (!entry || entry.shares <= 0) continue;

    const price = sharePriceForYear(
      grant.priceAssumption,
      year,
      grant.startYear
    );
    const vestedValueRaw = entry.shares * price;
    const prob = grant.vestingProbability ?? 1;
    const vestedValue = vestedValueRaw * prob;
    const grantWithholding = vestedValue * (grant.withholdingRate ?? 0.3);
    const netProceeds = vestedValue - grantWithholding;

    vestValue += vestedValue;
    withholding += grantWithholding;

    const destId = grant.destinationAccountId;
    if (destId) {
      byAccount[destId] = (byAccount[destId] ?? 0) + netProceeds;
    }
  }
  return {
    vestValue,
    withholding,
    netProceeds: vestValue - withholding,
    byAccount,
  };
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
  /** Accumulation phase: employee pre-tax (401k, IRA, 403b, HSA) payroll contributions. */
  employeePreTaxContribs?: number;
  /** Accumulation phase: employee Roth (Roth 401k, Roth IRA) payroll contributions. */
  employeeRothContribs?: number;
  /** Accumulation phase: employer match/contributions. */
  employerContribs?: number;
  /** Net cash deposited to checking (single source of truth per takeHomeDefinition). */
  netToChecking?: number;
  /** Taxes withheld via payroll (accumulation phase). */
  taxesPayroll?: number;
  /** Taxes outside payroll (e.g. estimated quarterly). Phase 1: typically 0. */
  taxesAdditional?: number;
  /** Cashflow identity check: Sources - Uses. Must be 0 within rounding; non-zero indicates model bug. */
  reconciliationDelta?: number;
  /** RSU vest value (W2 income) in accumulation phase. */
  rsuVestValue?: number;
  /** RSU withholding (tax withheld at vest). */
  rsuWithholding?: number;
  /** RSU net proceeds deposited to destination accounts. */
  rsuNetProceeds?: number;
  /** Withdrawal phase: amount withdrawn from Traditional (401k, IRA, 403b, HSA) accounts. */
  withdrawalsTraditional?: number;
  /** Withdrawal phase: amount withdrawn from Roth accounts. */
  withdrawalsRoth?: number;
  /** Withdrawal phase: amount withdrawn from taxable brokerage/money market accounts. */
  withdrawalsTaxable?: number;
  /** Withdrawal phase: taxes on withdrawals (traditional × rate + roth × 0 + taxable × 0 for MVP). */
  withdrawalTaxes?: number;
  /** Accumulation phase: unallocated surplus (routed to surplusDestinationAccountId when configured). */
  unallocatedSurplus?: number;
  /** Accumulation phase: salary-only gross income (excludes RSU vest value). For tax tracing. */
  salaryGross?: number;
  /** Accumulation phase: taxes on salary income only (taxableIncomeBase × effectiveTaxRate). Subset of taxesPayroll. */
  taxesFromSalary?: number;
  /** Accumulation phase: RSU tax (= rsuWithholding; explicit alias for tax tracing). */
  taxesFromRSU?: number;
}

export interface ValidationAssumption {
  code: string;
  message: string;
}

/** Structured breakdown when cashflow reconciliation fails. */
export interface ReconciliationBreakdown {
  year: number;
  phase: "accumulation" | "withdrawal";
  /** Sources: net income + other inflows (RSU, events, or withdrawals). */
  netIncome: number;
  otherInflows: number;
  /** Uses: spending, contributions, taxes. */
  spending: number;
  contributions: number;
  taxes: number;
  unallocatedSurplus: number;
  /** Sources - Uses; non-zero indicates model bug. */
  delta: number;
}

export interface ValidationErrorWithBreakdown {
  code: string;
  message: string;
  breakdown?: ReconciliationBreakdown;
}

export interface ProjectionValidation {
  errors: Array<ValidationErrorWithBreakdown>;
  warnings: Array<{ code: string; message: string }>;
  assumptions: ValidationAssumption[];
}

/** Shortfall when retiring by age before FI is met. */
export interface ShortfallData {
  portfolioSupportsPerYear: number;
  targetSpendPerYear: number;
}

export interface ProjectionResult {
  yearRows: YearRow[];
  fiNumber: number;
  fiYear: number | null;
  coastFiYear: number | null;
  /** Computed: first person birthYear + retirementAgeTarget (or scenario override). */
  retirementStartYear: number | null;
  /** True when retireWhen includes AGE and portfolio at retirement age cannot support target spend. */
  fiNotMetAtRetirementAge: boolean;
  /** When fiNotMetAtRetirementAge: portfolio supports $X/yr at SWR; target is $Y/yr. */
  shortfallData?: ShortfallData;
  savingsRate: number;
  validation: ProjectionValidation;
}

/**
 * Compute real return from nominal and inflation.
 * real ≈ (1 + nominal) / (1 + inflation) - 1
 */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Convert ContributionOverride to Contribution shape (drop source, personId). */
function overrideToContribution(o: ContributionOverride): Contribution {
  return {
    accountId: o.accountId,
    amountAnnual: o.amountAnnual,
    amountMonthly: o.amountMonthly,
    percentOfIncome: o.percentOfIncome,
    contributorType: o.contributorType ?? "employee",
    startYear: o.startYear,
    endYear: o.endYear,
    startMonth: o.startMonth,
    endMonth: o.endMonth,
  };
}

/**
 * Apply scenario contribution overrides to household.
 * Returns a merged household for scenario projection only (not plan projection).
 */
export function getEffectiveHouseholdForScenario(
  household: Household,
  scenario: Scenario
): Household {
  const overrides = scenario.contributionOverrides ?? [];
  if (overrides.length === 0) return household;

  const people = household.people.map((person) => {
    const payrollOverrides = overrides.filter(
      (o) => o.source === "payroll" && o.personId === person.id
    );
    if (payrollOverrides.length === 0)
      return person;

    const base = person.payroll.payrollInvesting ?? [];
    const byAccountId = new Map<string, Contribution>();
    for (const c of base) {
      byAccountId.set(c.accountId, c);
    }
    for (const o of payrollOverrides) {
      byAccountId.set(o.accountId, overrideToContribution(o));
    }
    const merged = Array.from(byAccountId.values());
    return {
      ...person,
      payroll: {
        ...person.payroll,
        payrollInvesting: merged,
      },
    };
  });

  const oopOverrides = overrides.filter((o) => o.source === "outOfPocket");
  const oopBase = household.outOfPocketInvesting ?? [];
  const oopByAccountId = new Map<string, Contribution>();
  for (const c of oopBase) {
    oopByAccountId.set(c.accountId, c);
  }
  for (const o of oopOverrides) {
    oopByAccountId.set(o.accountId, overrideToContribution(o));
  }
  const outOfPocketInvesting = Array.from(oopByAccountId.values());

  const savingsOverrides = overrides.filter((o) => o.source === "monthlySavings");
  const savingsBase = household.monthlySavings ?? [];
  const savingsByAccountId = new Map<string, Contribution>();
  for (const c of savingsBase) {
    savingsByAccountId.set(c.accountId, c);
  }
  for (const o of savingsOverrides) {
    savingsByAccountId.set(o.accountId, overrideToContribution(o));
  }
  const monthlySavings = Array.from(savingsByAccountId.values());

  // Merge household events with scenario-specific events (both applied in year order)
  const eventOverrides = scenario.eventOverrides ?? [];
  const effectiveEvents =
    eventOverrides.length === 0
      ? household.events ?? []
      : [...(household.events ?? []), ...eventOverrides].sort(
          (a, b) => a.year - b.year
        );

  return {
    ...household,
    people,
    outOfPocketInvesting,
    monthlySavings,
    events: effectiveEvents,
  };
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
  const salaryGrowthMode = scenario.salaryGrowthMode ?? "REAL";
  const getPersonGrossIncome = (person: Person, year: number): number => {
    const yearsFromStart = year - startYear;
    const growthOverride = scenario.salaryGrowthOverride;
    const salaryGrowth =
      growthOverride ?? person.income.salaryGrowthRate ?? 0;
    const salaryGrowthIsReal = person.income.salaryGrowthIsReal ?? true;
    let growthFactor: number;
    if (salaryGrowthMode === "NOMINAL") {
      growthFactor = Math.pow(1 + salaryGrowth, yearsFromStart);
    } else if (salaryGrowthMode === "REAL" && salaryGrowthIsReal) {
      // REAL mode + salaryGrowthIsReal=true: salaryGrowth is real growth (no inflation conversion)
      growthFactor = Math.pow(1 + salaryGrowth, yearsFromStart);
    } else {
      // REAL mode + salaryGrowthIsReal=false: real salary constant (inflation only)
      growthFactor = Math.pow(1 + inflation, yearsFromStart);
    }
    let income = person.income.baseSalaryAnnual * growthFactor;
    if (person.income.bonusAnnual) income += person.income.bonusAnnual;
    if (person.income.bonusPercent)
      income += person.income.baseSalaryAnnual * (person.income.bonusPercent / 100);
    return income;
  };

  // Payroll investing: Person payrollInvesting -> accountId (fixed or percent-of-income)
  // When includeEmployerMatch=false, exclude contributions where contributorType === "employer"
  const includeEmployerMatch = scenario.includeEmployerMatch ?? false;
  const getPayrollContributions = (year: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const person of people) {
      for (const c of person.payroll.payrollInvesting) {
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
    return out;
  };

  // Out-of-pocket investing: household-level contributions by account
  const getOutOfPocketContributions = (year: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of household.outOfPocketInvesting ?? []) {
      if (!appliesInYear(c, year)) continue;
      const amt = getProratedAnnualContribution(c, year);
      out[c.accountId] = (out[c.accountId] ?? 0) + amt;
    }
    return out;
  };

  // Monthly savings: household-level contributions by account (e.g. emergency fund, HYSA)
  const getMonthlySavingsContributions = (year: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of household.monthlySavings ?? []) {
      if (!appliesInYear(c, year)) continue;
      const amt = getProratedAnnualContribution(c, year);
      out[c.accountId] = (out[c.accountId] ?? 0) + amt;
    }
    return out;
  };

  // Gross income: sum of person incomes with salary growth
  const getGrossIncome = (year: number): number => {
    let total = 0;
    for (const person of people) {
      total += getPersonGrossIncome(person, year);
    }
    return total;
  };

  const takeHomeInput = scenario.takeHomeAnnual;
  const effectiveRate = scenario.effectiveTaxRate;
  const takeHomeDefinition = scenario.takeHomeDefinition ?? "NET_TO_CHECKING";
  const netToCheckingOverride = scenario.netToCheckingOverride;

  /**
   * Compute netToChecking and taxes.
   * Gross-driven (effectiveTaxRate): taxable base = grossSalary − preТax − payrollDeductions.
   *   taxesFromSalary = taxableBase × effectiveTaxRate. RSU withholding is tracked separately.
   * Take-home-driven (takeHomeAnnual): use takeHomeDefinition to interpret takeHomeAnnual.
   * OVERRIDE: use netToCheckingOverride when set.
   *
   * @param grossSalary - Salary income only (RSU vest value excluded; it is taxed via its own withholding rate).
   */
  const getNetToCheckingAndTaxes = (
    grossSalary: number,
    employeePreTaxContribs: number,
    employeeRothContribs: number,
    payrollDeductions: number
  ): { netToChecking: number; taxesPayroll: number; taxesFromSalary: number } => {
    let netToChecking: number;
    let taxesFromSalary: number;
    if (takeHomeDefinition === "OVERRIDE" && netToCheckingOverride != null) {
      netToChecking = netToCheckingOverride;
      taxesFromSalary =
        grossSalary -
        netToChecking -
        employeePreTaxContribs -
        employeeRothContribs -
        payrollDeductions;
    } else if (effectiveRate != null) {
      // Gross-driven: taxable income excludes pre-tax contributions and payroll deductions
      // (pre-tax 401k/403b reduce W-2 taxable income; payroll benefit deductions are pre-tax)
      const taxableIncome = grossSalary - employeePreTaxContribs - payrollDeductions;
      taxesFromSalary = taxableIncome * effectiveRate;
      netToChecking =
        grossSalary -
        taxesFromSalary -
        employeePreTaxContribs -
        employeeRothContribs -
        payrollDeductions;
    } else {
      // Take-home-driven: resolve afterTaxPay from takeHomeInput or fallback
      // When takeHomeInput is null, fallback already subtracts payrollDeductions
      const afterTaxPay =
        takeHomeInput != null ? takeHomeInput : grossSalary - payrollDeductions;
      if (takeHomeDefinition === "NET_TO_CHECKING") {
        // When user provides takeHomeAnnual, interpret as after-tax/401k; subtract payroll deductions to get net-to-checking
        netToChecking =
          takeHomeInput != null ? afterTaxPay - payrollDeductions : afterTaxPay;
      } else {
        // AFTER_TAX_ONLY: subtract payroll contributions; subtract payroll deductions when user-provided
        netToChecking =
          takeHomeInput != null
            ? afterTaxPay -
              employeePreTaxContribs -
              employeeRothContribs -
              payrollDeductions
            : afterTaxPay - employeePreTaxContribs - employeeRothContribs;
      }
      taxesFromSalary =
        grossSalary -
        netToChecking -
        employeePreTaxContribs -
        employeeRothContribs -
        payrollDeductions;
    }

    // taxesPayroll = salary taxes only (RSU withholding is tracked separately in rsuBreakdown.withholding)
    const taxesPayroll = taxesFromSalary;

    return { netToChecking, taxesPayroll, taxesFromSalary };
  };

  const currentMonthlySpend = scenario.currentMonthlySpend ?? 6353;
  const payrollDeductions =
    scenario.payrollDeductionsAnnual ??
    people.reduce(
      (s, p) => s + (p.payroll.payrollDeductionsSpending ?? 0),
      0
    );
  const currentAnnualSpend = currentMonthlySpend * 12 + payrollDeductions;

  const yearRows: YearRow[] = [];
  const validationErrors: Array<ValidationErrorWithBreakdown> = [];
  const validationWarnings: Array<{ code: string; message: string }> = [];
  const validationAssumptions: ValidationAssumption[] = [];

  let balances: Record<string, number> = {};
  for (const a of household.accounts) {
    balances[a.id] = a.startingBalance;
  }

  let fiYear: number | null = null;
  let coastFiYear: number | null = null;
  let firstYearIncome = 0;
  let firstYearSaving = 0;

  // Always use bucket-based withdrawal order (TAXABLE → TAX_DEFERRED → ROTH).
  // ROTH bucket includes both ROTH_401K and ROTH_IRA.
  const withdrawalBuckets =
    scenario.withdrawalOrderBuckets ?? [...DEFAULT_WITHDRAWAL_BUCKETS];
  const withdrawalOrderWithinBucket =
    scenario.withdrawalOrderWithinBucket ?? "SMALLEST_FIRST";

  const retireWhen = scenario.retireWhen ?? "EITHER";
  const firstPerson = people[0];
  const computedRetirementStartYear =
    firstPerson?.birthYear != null
      ? firstPerson.birthYear + scenario.retirementAgeTarget
      : startYear + 30;
  /** For EITHER: only use age-based retirement when scenario.retirementStartYear is explicitly set (backward compat). For AGE: always use computed. */
  const effectiveRetirementStartYear =
    scenario.retirementStartYear ??
    (retireWhen === "AGE" ? computedRetirementStartYear : null);

  let fiNotMetAtRetirementAge = false;
  let shortfallData: { portfolioSupportsPerYear: number; targetSpendPerYear: number } | undefined;
  let shortfallComputed = false;

  for (let i = 0; i < horizonYears; i++) {
    const year = startYear + i;

    // Determine if we're in withdrawal phase (retired) per retireWhen
    let inWithdrawal: boolean;
    if (retireWhen === "AGE") {
      inWithdrawal = effectiveRetirementStartYear != null && year >= effectiveRetirementStartYear;
    } else if (retireWhen === "FI") {
      inWithdrawal = fiYear != null && year > fiYear;
    } else {
      // EITHER: retirementStartYear OR FI (when retirementStartYear set); else FI only (backward compat)
      inWithdrawal =
        (effectiveRetirementStartYear != null && year >= effectiveRetirementStartYear) ||
        (fiYear != null && year > fiYear);
    }

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
    let rowEmployeePreTaxContribs: number | undefined;
    let rowEmployeeRothContribs: number | undefined;
    let rowEmployerContribs: number | undefined;
    let rowNetToChecking: number | undefined;
    let rowTaxesPayroll: number | undefined;
    let rowTaxesAdditional: number | undefined;
    let reconciliationDelta: number | undefined;
    let rowRsuVestValue: number | undefined;
    let rowRsuWithholding: number | undefined;
    let rowRsuNetProceeds: number | undefined;
    let rowSalaryGross: number | undefined;
    let rowTaxesFromSalary: number | undefined;
    let rowTaxesFromRSU: number | undefined;
    let rowWithdrawalsTraditional: number | undefined;
    let rowWithdrawalsRoth: number | undefined;
    let rowWithdrawalsTaxable: number | undefined;
    let rowWithdrawalTaxes: number | undefined;
    let rowUnallocatedSurplus: number | undefined;
    /** For CASHFLOW_RECONCILIATION_BREAKDOWN when delta != 0 */
    let breakdownNetIncome = 0;
    let breakdownOtherInflows = 0;
    let breakdownContributions = 0;

    if (inWithdrawal) {
      // Withdrawal phase: no income, withdraw from accounts to fund spending
      // NOMINAL mode: spending inflates each year; REAL mode: constant (today's dollars)
      const annualSpendThisYear =
        isReal ? annualRetirementSpend : annualRetirementSpend * Math.pow(1 + inflation, i);
      gross = 0;
      spending = annualSpendThisYear;
      netCashSurplus = -spending;
      for (const a of household.accounts) {
        contributionsByAccount[a.id] = 0;
      }

      // Shortfall check: when retiring by age, did we hit FI? (compute once on first withdrawal year)
      if (
        !shortfallComputed &&
        effectiveRetirementStartYear != null &&
        (retireWhen === "AGE" || retireWhen === "EITHER") &&
        year >= effectiveRetirementStartYear
      ) {
        shortfallComputed = true;
        const investedAtRetirement = household.accounts.reduce(
          (sum, a) => sum + (a.includedInFIAssets ? (balances[a.id] ?? 0) : 0),
          0
        );
        const portfolioSupportsPerYear = investedAtRetirement * scenario.swr;
        const targetSpendPerYear = annualSpendThisYear;
        if (portfolioSupportsPerYear < targetSpendPerYear - RECONCILIATION_ROUNDING_THRESHOLD) {
          fiNotMetAtRetirementAge = true;
          shortfallData = { portfolioSupportsPerYear, targetSpendPerYear };
          validationWarnings.push({
            code: "FI_NOT_MET_AT_RETIREMENT_AGE",
            message: `At retirement age (year ${year}), portfolio supports $${Math.round(portfolioSupportsPerYear).toLocaleString()}/yr at SWR; target spend is $${Math.round(targetSpendPerYear).toLocaleString()}/yr.`,
          });
        }
      }

      // Gross-up withdrawal: needNet = after-tax spending target.
      // Taxable/Roth: 1:1 (no tax). Traditional: gross-up so net = needNet / (1 - t).
      const needNet = annualSpendThisYear;
      const traditionalRate = Math.min(
        0.999,
        scenario.traditionalWithdrawalsTaxRate ??
          scenario.retirementEffectiveTaxRate ??
          0
      );
      const rothRate = scenario.rothWithdrawalsTaxRate ?? 0;
      const taxableRate =
        scenario.taxableWithdrawalsTaxRate ?? DEFAULT_TAXABLE_WITHDRAWAL_TAX_RATE;

      // Re-compute ordered accounts each year so within-bucket ordering reflects current balances
      const orderedAccounts = getAccountsInWithdrawalOrderByBuckets(
        household.accounts,
        withdrawalBuckets,
        withdrawalOrderWithinBucket,
        balances
      );
      const accessibleTypes = getAccessibleAccountTypes(year, people);
      const accessibleAccounts = orderedAccounts.filter((a) =>
        accessibleTypes.has(a.type)
      );
      const accountById = new Map(household.accounts.map((a) => [a.id, a]));
      let remainingNeedNet = needNet;
      const preGrowthBalances = { ...balances };

      for (const a of accessibleAccounts) {
        if (remainingNeedNet <= 0) break;
        const available = preGrowthBalances[a.id] ?? 0;
        if (available <= 0) continue;

        if (isPreTaxRetirement(a.type)) {
          // Traditional: gross-up so net = remainingNeedNet
          const grossNeeded = remainingNeedNet / (1 - traditionalRate);
          const withdraw = Math.min(available, grossNeeded);
          if (withdraw > 0) {
            withdrawalByAccount[a.id] = withdraw;
            preGrowthBalances[a.id] = available - withdraw;
            const netFromWithdraw = withdraw * (1 - traditionalRate);
            remainingNeedNet -= netFromWithdraw;
          }
        } else if (isTaxableBrokerage(a.type) && taxableRate > 0) {
          // Taxable with tax: gross-up so net = remainingNeedNet
          const safeTaxableRate = Math.min(0.999, taxableRate);
          const grossNeeded = remainingNeedNet / (1 - safeTaxableRate);
          const withdraw = Math.min(available, grossNeeded);
          if (withdraw > 0) {
            withdrawalByAccount[a.id] = withdraw;
            preGrowthBalances[a.id] = available - withdraw;
            const netFromWithdraw = withdraw * (1 - safeTaxableRate);
            remainingNeedNet -= netFromWithdraw;
          }
        } else {
          // Roth, CASH, or taxable with rate 0: 1:1 net
          const withdraw = Math.min(available, remainingNeedNet);
          if (withdraw > 0) {
            withdrawalByAccount[a.id] = withdraw;
            preGrowthBalances[a.id] = available - withdraw;
            remainingNeedNet -= withdraw;
          }
        }
      }
      balances = preGrowthBalances;

      const totalWithdrawn = Object.values(withdrawalByAccount).reduce(
        (s, v) => s + v,
        0
      );
      if (remainingNeedNet > RECONCILIATION_ROUNDING_THRESHOLD) {
        withdrawalShortfall = remainingNeedNet;
      }

      // Split withdrawals by account type for per-type tax rates
      let withdrawalsTraditional = 0;
      let withdrawalsRoth = 0;
      let withdrawalsTaxable = 0;
      for (const [accountId, amount] of Object.entries(withdrawalByAccount)) {
        const acct = accountById.get(accountId);
        if (!acct) continue;
        if (isPreTaxRetirement(acct.type)) withdrawalsTraditional += amount;
        else if (ROTH_ACCOUNT_TYPES.has(acct.type)) withdrawalsRoth += amount;
        else if (isTaxableBrokerage(acct.type)) withdrawalsTaxable += amount;
      }

      const withdrawalTaxes =
        withdrawalsTraditional * traditionalRate +
        withdrawalsRoth * rothRate +
        withdrawalsTaxable * taxableRate;
      taxes = withdrawalTaxes;

      rowWithdrawalsTraditional = withdrawalsTraditional;
      rowWithdrawalsRoth = withdrawalsRoth;
      rowWithdrawalsTaxable = withdrawalsTaxable;
      rowWithdrawalTaxes = withdrawalTaxes;

      // RETIREMENT_TAX_ZERO: traditional > 0 but taxes ≈ 0 indicates misconfiguration
      if (
        withdrawalsTraditional > RECONCILIATION_ROUNDING_THRESHOLD &&
        withdrawalTaxes < RECONCILIATION_ROUNDING_THRESHOLD
      ) {
        validationErrors.push({
          code: "RETIREMENT_TAX_ZERO",
          message: `Traditional withdrawals ($${Math.round(withdrawalsTraditional).toLocaleString()}) in year ${year} but withdrawal taxes are ~$0. Set traditionalWithdrawalsTaxRate or retirementEffectiveTaxRate.`,
        });
      }

      // Withdrawal phase reconciliation: otherNetInflows = totalWithdrawn; cashSavingsChange = 0
      const otherNetInflows = totalWithdrawn;
      const cashSavingsChange = 0;
      breakdownNetIncome = 0;
      breakdownOtherInflows = totalWithdrawn;
      breakdownContributions = 0;
      reconciliationDelta =
        0 +
        otherNetInflows -
        spending -
        0 -
        cashSavingsChange -
        taxes;
    } else {
      // Accumulation phase: income, taxes, contributions, growth
      const rsuBreakdown = getRsuVestBreakdown(household, year, scenario);
      const salaryGrossThisYear = getGrossIncome(year);
      // gross = total W-2 income for display; salary and RSU taxed separately
      gross = salaryGrossThisYear + rsuBreakdown.vestValue;
      if (i === 0) firstYearIncome = gross;

      spending =
        scenario.modelingMode === "NOMINAL" && i > 0
          ? currentAnnualSpend * Math.pow(1 + inflation, i)
          : currentAnnualSpend;

      const payrollContrib = getPayrollContributions(year);
      let oopContrib = getOutOfPocketContributions(year);
      let savingsContrib = getMonthlySavingsContributions(year);
      const rsuProceeds = rsuBreakdown.byAccount;

      // Cap emergency fund contributions at remaining room — avoids overshooting goal mid-year
      const efGoal = household.emergencyFundGoal;
      if (efGoal?.targetAmount != null && efGoal?.accountId != null) {
        const efId = efGoal.accountId;
        const currentBalance = balances[efId] ?? 0;
        const roomRemaining = Math.max(0, efGoal.targetAmount - currentBalance);
        const oopAmt = oopContrib[efId] ?? 0;
        const savAmt = savingsContrib[efId] ?? 0;
        const totalPlanned = oopAmt + savAmt;
        if (totalPlanned > roomRemaining) {
          // Cap savings first (most common source), then OOP; excess flows to surplus routing
          const cappedSav = Math.min(savAmt, roomRemaining);
          const cappedOop = Math.min(oopAmt, Math.max(0, roomRemaining - cappedSav));
          savingsContrib = { ...savingsContrib, [efId]: cappedSav };
          oopContrib = { ...oopContrib, [efId]: cappedOop };
        }
      }

      // Merge raw contributions, then cap at IRS limits (use capped for cashflow)
      for (const a of household.accounts) {
        contributionsByAccount[a.id] =
          (payrollContrib[a.id] ?? 0) +
          (oopContrib[a.id] ?? 0) +
          (savingsContrib[a.id] ?? 0) +
          (rsuProceeds[a.id] ?? 0);
      }
      const breakdown = getContributionsBreakdown(household, scenario, year);
      const capped = capContributionsAtIRSLimits(
        household,
        scenario,
        year,
        contributionsByAccount,
        breakdown
      );
      for (const a of household.accounts) {
        contributionsByAccount[a.id] = capped[a.id] ?? 0;
      }

      // Payroll split from CAPPED contributions (for netToChecking / taxes)
      const payrollSplit = getPayrollContributionsSplitFromCapped(
        household,
        capped,
        breakdown
      );
      const {
        employeePreTaxContribs,
        employeeRothContribs,
        employerContribs,
      } = payrollSplit;

      const { netToChecking, taxesPayroll, taxesFromSalary } = getNetToCheckingAndTaxes(
        salaryGrossThisYear,   // salary only — RSU is taxed via its own withholding rate
        employeePreTaxContribs,
        employeeRothContribs,
        payrollDeductions
      );
      // Total taxes = salary taxes + RSU withholding (no double-counting)
      taxes = taxesPayroll + rsuBreakdown.withholding;
      const taxesAdditional = 0; // Phase 1: no taxes outside payroll

      const totalOopContrib = Object.values(oopContrib).reduce(
        (s, v) => s + v,
        0
      );
      const totalSavingsContrib = Object.values(savingsContrib).reduce(
        (s, v) => s + v,
        0
      );

      netCashSurplus =
        netToChecking - spending - totalOopContrib - totalSavingsContrib;

      // Events for this year (for reconciliation)
      const yearEvents = (household.events ?? []).filter((e) => e.year === year);
      const eventInflows = yearEvents
        .filter((e) => e.kind === "INFLOW")
        .reduce((s, e) => s + e.amount, 0);
      const eventOutflows = yearEvents
        .filter((e) => e.kind === "OUTFLOW")
        .reduce((s, e) => s + e.amount, 0);

      const rsuNetTotal = rsuBreakdown.netProceeds;
      const otherNetInflows = rsuNetTotal + eventInflows;
      const afterTaxContribs = totalOopContrib + totalSavingsContrib;
      breakdownNetIncome = netToChecking;
      breakdownOtherInflows = otherNetInflows;
      breakdownContributions = afterTaxContribs;
      const cashSavingsChange =
        netCashSurplus + rsuNetTotal + eventInflows - eventOutflows;
      reconciliationDelta =
        netToChecking +
        otherNetInflows -
        spending -
        afterTaxContribs -
        cashSavingsChange -
        taxesAdditional;

      // Unallocated Surplus: route checking surplus to surplusDestinationAccountId.
      // Checking surplus = netToChecking minus lifestyle spending and after-tax contributions.
      // (payrollDeductions are excluded from lifestyleSpend since they already came out of netToChecking)
      const enableUnallocatedSurplusBalancing =
        scenario.enableUnallocatedSurplusBalancing ?? true;
      if (enableUnallocatedSurplusBalancing) {
        const lifestyleSpend = spending - payrollDeductions;
        const checkingSurplus =
          netToChecking - lifestyleSpend - totalOopContrib - totalSavingsContrib;
        if (checkingSurplus > RECONCILIATION_ROUNDING_THRESHOLD) {
          rowUnallocatedSurplus = checkingSurplus;
          const destId = scenario.surplusDestinationAccountId;
          if (destId && household.accounts.some((a) => a.id === destId)) {
            // Credit surplus to destination account — reflected in net worth and FI assets
            contributionsByAccount[destId] =
              (contributionsByAccount[destId] ?? 0) + checkingSurplus;
          } else {
            // No destination configured: emit a warning (first occurrence only)
            if (!validationWarnings.some((w) => w.code === "SURPLUS_NO_DESTINATION")) {
              validationWarnings.push({
                code: "SURPLUS_NO_DESTINATION",
                message: `Unallocated cash surplus detected (e.g. $${Math.round(checkingSurplus).toLocaleString()} in ${year}). Set surplusDestinationAccountId on the scenario to route it to an account and include it in net worth.`,
              });
            }
          }
        }
      } else {
        // Legacy: route overflow to taxable when autoFixOverflow enabled
        const autoFixOverflow = scenario.autoFixOverflow ?? false;
        if (
          autoFixOverflow &&
          reconciliationDelta != null &&
          reconciliationDelta > RECONCILIATION_ROUNDING_THRESHOLD
        ) {
          const taxableAccount = household.accounts.find(
            (a) => a.type === "TAXABLE" || a.type === "MONEY_MARKET"
          );
          if (taxableAccount) {
            contributionsByAccount[taxableAccount.id] =
              (contributionsByAccount[taxableAccount.id] ?? 0) +
              reconciliationDelta;
            reconciliationDelta = 0;
            validationWarnings.push({
              code: "AUTO_OVERFLOW_ROUTING_ENABLED",
              message: `Overflow routed to ${taxableAccount.name} in year ${year}`,
            });
          }
        }
      }

      // Store new YearRow fields for accumulation phase
      rowEmployeePreTaxContribs = employeePreTaxContribs;
      rowEmployeeRothContribs = employeeRothContribs;
      rowEmployerContribs = employerContribs;
      rowNetToChecking = netToChecking;
      rowTaxesPayroll = taxesPayroll;
      rowTaxesAdditional = taxesAdditional;
      rowRsuVestValue = rsuBreakdown.vestValue;
      rowRsuWithholding = rsuBreakdown.withholding;
      rowRsuNetProceeds = rsuBreakdown.netProceeds;
      rowSalaryGross = salaryGrossThisYear;
      rowTaxesFromSalary = taxesFromSalary;
      rowTaxesFromRSU = rsuBreakdown.withholding;
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
    if (rowEmployeePreTaxContribs != null) row.employeePreTaxContribs = rowEmployeePreTaxContribs;
    if (rowEmployeeRothContribs != null) row.employeeRothContribs = rowEmployeeRothContribs;
    if (rowEmployerContribs != null) row.employerContribs = rowEmployerContribs;
    if (rowNetToChecking != null) row.netToChecking = rowNetToChecking;
    if (rowTaxesPayroll != null) row.taxesPayroll = rowTaxesPayroll;
    if (rowTaxesAdditional != null) row.taxesAdditional = rowTaxesAdditional;
    if (rowRsuVestValue != null) row.rsuVestValue = rowRsuVestValue;
    if (rowRsuWithholding != null) row.rsuWithholding = rowRsuWithholding;
    if (rowRsuNetProceeds != null) row.rsuNetProceeds = rowRsuNetProceeds;
    if (rowUnallocatedSurplus != null) row.unallocatedSurplus = rowUnallocatedSurplus;
    if (rowSalaryGross != null) row.salaryGross = rowSalaryGross;
    if (rowTaxesFromSalary != null) row.taxesFromSalary = rowTaxesFromSalary;
    if (rowTaxesFromRSU != null) row.taxesFromRSU = rowTaxesFromRSU;
    if (rowWithdrawalsTraditional != null) row.withdrawalsTraditional = rowWithdrawalsTraditional;
    if (rowWithdrawalsRoth != null) row.withdrawalsRoth = rowWithdrawalsRoth;
    if (rowWithdrawalsTaxable != null) row.withdrawalsTaxable = rowWithdrawalsTaxable;
    if (rowWithdrawalTaxes != null) row.withdrawalTaxes = rowWithdrawalTaxes;
    if (Object.keys(withdrawalByAccount).length > 0) {
      row.withdrawalByAccount = withdrawalByAccount;
    }
    if (withdrawalShortfall != null && withdrawalShortfall > 0) {
      row.withdrawalShortfall = withdrawalShortfall;
    }
    if (phase === "withdrawal") {
      row.withdrawalPhaseTaxes = taxes;
    }
    if (reconciliationDelta != null) {
      row.reconciliationDelta = reconciliationDelta;
      if (
        Math.abs(reconciliationDelta) > RECONCILIATION_ROUNDING_THRESHOLD
      ) {
        const breakdown: ReconciliationBreakdown = {
          year,
          phase,
          netIncome: breakdownNetIncome,
          otherInflows: breakdownOtherInflows,
          spending,
          contributions: breakdownContributions,
          taxes: (rowTaxesPayroll ?? 0) + (rowTaxesAdditional ?? 0) + (rowWithdrawalTaxes ?? 0),
          unallocatedSurplus: rowUnallocatedSurplus ?? 0,
          delta: reconciliationDelta,
        };
        validationErrors.push({
          code: "CASHFLOW_RECONCILIATION_BREAKDOWN",
          message: `Cashflow doesn't reconcile in year ${year}: delta = $${reconciliationDelta >= 0 ? "+" : ""}${reconciliationDelta.toFixed(2)}. Suggested fixes: Enable Unallocated Surplus balancing, add a CHECKING account for NET_TO_CHECKING, or check withdrawal tax funding.`,
          breakdown,
        });
      }
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

  // Populate assumptions per data contract
  validationAssumptions.push({
    code: "INFLATION_DEFINITION",
    message: `Inflation ${(inflation * 100).toFixed(1)}% used for salary growth when salaryGrowthMode=REAL and for real-return modeling.`,
  });
  validationAssumptions.push({
    code: "TAX_MODEL_LEVEL",
    message: "Tax model: effective rates (takeHome/annual). No bracket-level modeling.",
  });
  const enabledGrants = (household.equityGrants ?? []).filter((g) =>
    isGrantEnabledForScenario(g.id, g, scenario)
  );
  if (enabledGrants.length > 0) {
    const strategies = [...new Set(enabledGrants.map((g) => g.sellStrategy ?? "SELL_ALL"))];
    validationAssumptions.push({
      code: "RSU_SELL_STRATEGY",
      message: `RSU: ${strategies.join(", ")}. Vest value = W2 income; net proceeds to destination. HOLD deposits to EMPLOYER_STOCK (account's includedInFIAssets controls FI).`,
    });
  }

  return {
    yearRows,
    fiNumber,
    fiYear,
    coastFiYear,
    retirementStartYear: effectiveRetirementStartYear,
    fiNotMetAtRetirementAge,
    shortfallData,
    savingsRate,
    validation: {
      errors: validationErrors,
      warnings: validationWarnings,
      assumptions: validationAssumptions,
    },
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
