/**
 * Zod schemas for FI/RE Planner MVP.
 * MVP subset of docs/model/DATA_SCHEMA.md.
 */

import { z } from "zod";

export const EventKindSchema = z.enum(["INFLOW", "OUTFLOW"]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const EventSchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number(),
  amount: z.number(),
  kind: EventKindSchema,
  accountId: z.string().optional(),
  notes: z.string().optional(),
});
export type Event = z.infer<typeof EventSchema>;

// RSU / equity grant schemas
export const PriceAssumptionModeSchema = z.enum(["FIXED", "GROWTH"]);
export type PriceAssumptionMode = z.infer<typeof PriceAssumptionModeSchema>;

export const PriceAssumptionSchema = z
  .object({
    mode: PriceAssumptionModeSchema,
    fixedPrice: z.number().optional(),
    growthRate: z.number().optional(),
  })
  .refine(
    (v) =>
      (v.mode === "FIXED" && v.fixedPrice != null) ||
      (v.mode === "GROWTH" && v.growthRate != null),
    { message: "FIXED requires fixedPrice; GROWTH requires growthRate" }
  );
export type PriceAssumption = z.infer<typeof PriceAssumptionSchema>;

export const VestingEntrySchema = z.object({
  year: z.number(),
  shares: z.number(),
});
export type VestingEntry = z.infer<typeof VestingEntrySchema>;

export const SellStrategySchema = z
  .enum(["SELL_ALL", "SELL_TO_COVER", "HOLD"])
  .optional()
  .default("SELL_ALL");
export type SellStrategy = z.infer<typeof SellStrategySchema>;

export const EquityGrantSchema = z.object({
  id: z.string(),
  ownerPersonId: z.string(),
  type: z.literal("RSU"),
  startYear: z.number(),
  endYear: z.number().optional(),
  vestingTable: z.array(VestingEntrySchema),
  priceAssumption: PriceAssumptionSchema,
  /** Tax withholding rate at vest (0–1). Default 0.30 (30%). */
  withholdingRate: z.number().min(0).max(1).default(0.3),
  destinationAccountId: z.string(),
  /** SELL_ALL: sell all shares, deposit net proceeds to destination. HOLD: deposit net share value to EMPLOYER_STOCK. SELL_TO_COVER: sell to cover taxes only. Default SELL_ALL. */
  sellStrategy: SellStrategySchema.optional(),
  /** Whether this grant is included in projections. Default true. Scenario override can disable per scenario. */
  isEnabled: z.boolean().optional(),
  /** Probability of vesting (0–1). Optional; when set, vest value is scaled by this factor. */
  vestingProbability: z.number().min(0).max(1).optional(),
});
export type EquityGrant = z.infer<typeof EquityGrantSchema>;

export const EquityPolicySchema = z
  .object({
    defaultWithholdingRate: z.number().min(0).max(1).optional(),
    defaultDestinationAccountId: z.string().optional(),
  })
  .optional();
export type EquityPolicy = z.infer<typeof EquityPolicySchema>;

/** Employee vs employer: IRS limits differ (e.g. 401k employee $23.5k, combined $70k). Payroll only. */
export const ContributorTypeSchema = z.enum(["employee", "employer"]);
export type ContributorType = z.infer<typeof ContributorTypeSchema>;

export const ContributionSchema = z
  .object({
    accountId: z.string(),
    amountAnnual: z.number().optional(),
    amountMonthly: z.number().optional(),
    percentOfIncome: z.number().min(0).max(100).optional(),
    /** Employee vs employer contributions; payroll only. Default employee. Affects 401k/403b limit checks. */
    contributorType: ContributorTypeSchema.optional().default("employee"),
    startYear: z.number().optional(),
    endYear: z.number().optional(),
    startMonth: z.number().min(1).max(12).optional(),
    endMonth: z.number().min(1).max(12).optional(),
  })
  .refine(
    (c) =>
      (c.amountAnnual != null || c.amountMonthly != null) !==
      (c.percentOfIncome != null),
    { message: "Use either fixed amount OR percentOfIncome, not both." }
  );
export type Contribution = z.infer<typeof ContributionSchema>;

/** Scenario-level override for a contribution. Matches by source + personId (payroll) + accountId. */
export const ContributionOverrideSchema = z
  .object({
    source: z.enum(["payroll", "outOfPocket", "monthlySavings"]),
    personId: z.string().optional(), // required when source is payroll
    accountId: z.string(),
    amountAnnual: z.number().optional(),
    amountMonthly: z.number().optional(),
    percentOfIncome: z.number().min(0).max(100).optional(),
    contributorType: ContributorTypeSchema.optional(),
    startYear: z.number().optional(),
    endYear: z.number().optional(),
    startMonth: z.number().min(1).max(12).optional(),
    endMonth: z.number().min(1).max(12).optional(),
  })
  .refine(
    (c) =>
      (c.amountAnnual != null || c.amountMonthly != null) !==
      (c.percentOfIncome != null),
    { message: "Use either fixed amount OR percentOfIncome, not both." }
  )
  .refine(
    (c) => c.source !== "payroll" || c.personId != null,
    { message: "personId is required when source is payroll." }
  );
export type ContributionOverride = z.infer<typeof ContributionOverrideSchema>;

export const IncomeModelSchema = z.object({
  baseSalaryAnnual: z.number(),
  salaryGrowthRate: z.number().default(0),
  salaryGrowthIsReal: z.boolean().default(true),
  bonusAnnual: z.number().optional(),
  bonusPercent: z.number().optional(),
});
export type IncomeModel = z.infer<typeof IncomeModelSchema>;

export const PayrollModelSchema = z.object({
  payrollInvesting: z.array(ContributionSchema).default([]),
  payrollDeductionsSpending: z.number().default(0),
  employerMatch: z.null().optional(),
});
export type PayrollModel = z.infer<typeof PayrollModelSchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  birthYear: z.number().optional(),
  income: IncomeModelSchema,
  payroll: PayrollModelSchema,
});
export type Person = z.infer<typeof PersonSchema>;

/** Legacy types for migration: TRADITIONAL → TRADITIONAL_401K, ROTH → ROTH_IRA */
const LegacyAccountTypeSchema = z
  .enum(["TRADITIONAL", "ROTH"])
  .transform((v) => (v === "TRADITIONAL" ? "TRADITIONAL_401K" : "ROTH_IRA"));

export const AccountTypeSchema = z.union([
  z.enum([
    "CASH",
    "CHECKING",
    "TAXABLE",
    "MONEY_MARKET",
    "EMPLOYER_STOCK",
    "TRADITIONAL_401K",
    "ROTH_401K",
    "TRADITIONAL_IRA",
    "ROTH_IRA",
    "403B",
    "HSA",
  ]),
  LegacyAccountTypeSchema,
]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const OwnerSchema = z.enum(["PERSON_A", "PERSON_B", "JOINT"]);
export type Owner = z.infer<typeof OwnerSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  owner: OwnerSchema,
  startingBalance: z.number().default(0),
  includedInFIAssets: z.boolean().default(true),
  /** APY (Annual Percentage Yield) as decimal, e.g. 0.045 for 4.5%. Only used for MONEY_MARKET accounts; growth uses this instead of scenario return. */
  apy: z.number().min(0).max(0.5).optional(),
  /** Whether this is an employer-sponsored plan (401k, 403b, Roth 401k). Used for FOO Employer Match step tracking. IRAs are not employer-sponsored. */
  isEmployerSponsored: z.boolean().optional(),
});
export type Account = z.infer<typeof AccountSchema>;

export const ModelingModeSchema = z.enum(["REAL", "NOMINAL"]);
export type ModelingMode = z.infer<typeof ModelingModeSchema>;

export const SalaryGrowthModeSchema = z
  .enum(["NOMINAL", "REAL"])
  .default("REAL");
export type SalaryGrowthMode = z.infer<typeof SalaryGrowthModeSchema>;

export const TakeHomeDefinitionSchema = z
  .enum(["NET_TO_CHECKING", "AFTER_TAX_ONLY", "OVERRIDE"])
  .default("NET_TO_CHECKING");
export type TakeHomeDefinition = z.infer<typeof TakeHomeDefinitionSchema>;

export const RetireWhenSchema = z
  .enum(["AGE", "FI", "EITHER"])
  .default("EITHER");
export type RetireWhen = z.infer<typeof RetireWhenSchema>;

export const WithdrawalBucketSchema = z.enum(["TAXABLE", "TAX_DEFERRED", "ROTH"]);
export type WithdrawalBucket = z.infer<typeof WithdrawalBucketSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  modelingMode: ModelingModeSchema.default("REAL"),
  nominalReturn: z.number(),
  inflation: z.number(),
  effectiveTaxRate: z.number().nullable(),
  takeHomeAnnual: z.number().nullable(),
  takeHomeDefinition: TakeHomeDefinitionSchema,
  netToCheckingOverride: z.number().nullable().optional(),
  swr: z.number(),
  retirementMonthlySpend: z.number(),
  currentMonthlySpend: z.number().optional(), // current spending before retirement
  retirementAgeTarget: z.number().default(65),
  salaryGrowthOverride: z.number().nullable().optional(),
  /** NOMINAL: salary grows by salaryGrowthRate. REAL: real salary constant; nominal grows by inflation. */
  salaryGrowthMode: SalaryGrowthModeSchema,
  includeEmployerMatch: z.boolean().default(false),
  equityPolicy: EquityPolicySchema.optional(),
  retirementStartYear: z.number().optional(),
  /** AGE: retire at target age only. FI: retire when portfolio reaches FI. EITHER: whichever comes first. */
  retireWhen: RetireWhenSchema,
  /** @deprecated Use withdrawalOrderBuckets. Kept for backward compatibility. */
  withdrawalOrder: z
    .array(AccountTypeSchema)
    .default(["TAXABLE", "MONEY_MARKET", "TRADITIONAL_401K", "TRADITIONAL_IRA", "403B", "ROTH_401K", "ROTH_IRA"]),
  /** Bucket-based withdrawal order. Engine prefers this over withdrawalOrder if present. */
  withdrawalOrderBuckets: z
    .array(WithdrawalBucketSchema)
    .default(["TAXABLE", "TAX_DEFERRED", "ROTH"]),
  stressTestFirstYearReturn: z.number().nullable().optional(),
  /** @deprecated Use traditionalWithdrawalsTaxRate. Kept for backward compatibility. */
  retirementEffectiveTaxRate: z.number().min(0).max(1).optional(),
  /** Effective tax rate on Traditional (401k, IRA, 403b, HSA) withdrawals. Falls back to retirementEffectiveTaxRate if unset. */
  traditionalWithdrawalsTaxRate: z.number().min(0).max(1).optional(),
  /** Effective tax rate on Roth withdrawals. MVP: always 0. */
  rothWithdrawalsTaxRate: z.number().min(0).max(1).optional().default(0),
  /** Effective tax rate on taxable brokerage withdrawals. MVP: 0 (capital gains modeled separately later). */
  taxableWithdrawalsTaxRate: z.number().min(0).max(1).optional().default(0),
  contributionOverrides: z.array(ContributionOverrideSchema).optional().default([]),
  eventOverrides: z.array(EventSchema).optional().default([]),
  /** When true and reconciliationDelta > 0, route overflow to Taxable Brokerage (Overflow). */
  autoFixOverflow: z.boolean().optional().default(false),
  /** When true and reconciliationDelta > 0 in accumulation, post surplus to pseudo-expense (no FI impact). */
  enableUnallocatedSurplusBalancing: z.boolean().optional().default(true),
  /** Frequency for unallocated surplus balancing. Phase 1: both treated as annual. */
  unallocatedSurplusFrequency: z.enum(["Monthly", "Annual"]).optional().default("Monthly"),
  /** Per-grant overrides: exclude grants from this scenario when isEnabled: false. */
  equityGrantOverrides: z
    .array(
      z.object({
        grantId: z.string(),
        isEnabled: z.boolean().optional(),
      })
    )
    .optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const EmergencyFundGoalSchema = z
  .object({
    targetAmount: z.number().min(0),
    accountId: z.string().nullable(),
  })
  .optional();
export type EmergencyFundGoal = z.infer<typeof EmergencyFundGoalSchema>;

export const HouseholdSchema = z.object({
  id: z.string(),
  name: z.string(),
  startYear: z.number(),
  currency: z.string().default("USD"),
  people: z.array(PersonSchema),
  accounts: z.array(AccountSchema),
  scenarios: z.array(ScenarioSchema),
  outOfPocketInvesting: z.array(ContributionSchema).default([]),
  monthlySavings: z.array(ContributionSchema).default([]),
  events: z.array(EventSchema).default([]),
  equityGrants: z.array(EquityGrantSchema).default([]),
  emergencyFundGoal: EmergencyFundGoalSchema.optional(),
  /** Scenario used for FOO/plan projection; defaults to first scenario. */
  planScenarioId: z.string().nullable().optional(),
});
export type Household = z.infer<typeof HouseholdSchema>;
