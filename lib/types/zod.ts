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

export const EquityGrantSchema = z.object({
  id: z.string(),
  ownerPersonId: z.string(),
  type: z.literal("RSU"),
  startYear: z.number(),
  endYear: z.number().optional(),
  vestingTable: z.array(VestingEntrySchema),
  priceAssumption: PriceAssumptionSchema,
  withholdingRate: z.number().min(0).max(1),
  destinationAccountId: z.string(),
});
export type EquityGrant = z.infer<typeof EquityGrantSchema>;

export const EquityPolicySchema = z
  .object({
    defaultWithholdingRate: z.number().min(0).max(1).optional(),
    defaultDestinationAccountId: z.string().optional(),
  })
  .optional();
export type EquityPolicy = z.infer<typeof EquityPolicySchema>;

export const ContributionSchema = z
  .object({
    accountId: z.string(),
    amountAnnual: z.number().optional(),
    amountMonthly: z.number().optional(),
    percentOfIncome: z.number().min(0).max(100).optional(),
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

export const AccountTypeSchema = z.enum([
  "CASH",
  "TAXABLE",
  "MONEY_MARKET",
  "TRADITIONAL",
  "403B",
  "ROTH",
  "HSA",
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
});
export type Account = z.infer<typeof AccountSchema>;

export const ModelingModeSchema = z.enum(["REAL", "NOMINAL"]);
export type ModelingMode = z.infer<typeof ModelingModeSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  modelingMode: ModelingModeSchema.default("REAL"),
  nominalReturn: z.number(),
  inflation: z.number(),
  effectiveTaxRate: z.number().nullable(),
  takeHomeAnnual: z.number().nullable(),
  swr: z.number(),
  retirementMonthlySpend: z.number(),
  currentMonthlySpend: z.number().optional(), // current spending before retirement
  retirementAgeTarget: z.number().default(65),
  salaryGrowthOverride: z.number().nullable().optional(),
  includeEmployerMatch: z.boolean().default(false),
  equityPolicy: EquityPolicySchema.optional(),
  retirementStartYear: z.number().optional(),
  withdrawalOrder: z
    .array(AccountTypeSchema)
    .default(["TAXABLE", "MONEY_MARKET", "TRADITIONAL", "403B", "ROTH"]),
  stressTestFirstYearReturn: z.number().nullable().optional(),
  retirementEffectiveTaxRate: z.number().min(0).max(1).optional(),
  contributionOverrides: z.array(ContributionOverrideSchema).optional().default([]),
  eventOverrides: z.array(EventSchema).optional().default([]),
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
