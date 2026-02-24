# DATA_SCHEMA.md — Data Model (Human-Readable)

This file defines the shape of objects stored in local persistence (v1: localStorage/IndexedDB) and exported/imported as JSON.

---

## Household
- `id` (string)
- `name` (string)
- `startYear` (number)
- `currency` (string, default "USD")
- `people` (Person[])
- `accounts` (Account[])
- `scenarios` (Scenario[])
- `outOfPocketInvesting` (Contribution[]) — money from take-home invested into accounts
- `monthlySavings` (Contribution[]) — regular savings into accounts (e.g. emergency fund, HYSA)
- `events` (Event[])
- `equityGrants` (EquityGrant[])
- `emergencyFundGoal` (EmergencyFundGoal, optional) — target amount and account to track for emergency fund

### EmergencyFundGoal
- `targetAmount` (number) — target balance to reach
- `accountId` (string | null) — account whose balance is tracked (e.g. HYSA, savings)

---

## Person
- `id`
- `name`
- `birthYear` (optional; or `currentAge`)
- `income` (IncomeModel)
- `payroll` (PayrollModel)

### IncomeModel
- `baseSalaryAnnual`
- `salaryGrowthRate` (number)
- `salaryGrowthIsReal` (boolean)
- `bonusAnnual` (optional fixed number)
- `bonusPercent` (optional; mutually exclusive with bonusAnnual)

### PayrollModel
- `payrollInvesting` (Contribution[])  // e.g., 401k employee, HSA
- `payrollDeductionsSpending` (number) // insurance premiums etc. (annualized)
- `employerMatch` (EmployerMatchModel | null)

### Contribution
- `accountId`
- `amountAnnual` (number) OR `amountMonthly` (number)
- `startYear` (number, optional)
- `endYear` (number, optional)
- `startMonth` (number 1–12, optional) — first month of contribution in startYear; enables partial-year proration
- `endMonth` (number 1–12, optional) — last month of contribution in endYear

### EmployerMatchModel (v1 simple)
- `matchPercent` (e.g., 0.05 for 5% match)
- `matchCapPercentOfSalary` (e.g., 0.05)
- `depositToAccountId` (usually same pre-tax account)

---

## Account
- `id`
- `name`
- `type` (enum): CASH | TAXABLE | MONEY_MARKET | TRADITIONAL | 403B | ROTH | HSA | EQUITY
- `owner` (enum): PERSON_A | PERSON_B | JOINT
- `startingBalance` (number)
- `includedInFIAssets` (boolean, default true except maybe CASH)
- `apy` (number, optional): For MONEY_MARKET only. Annual Percentage Yield as decimal (e.g. 0.045 for 4.5%). When set, growth uses this rate instead of scenario return.
- `accessibility` (AccessibilityModel)

### AccessibilityModel (optional v1)
- `isAccessibleBefore59_5` (boolean)
- `notes` (string)

---

## Scenario
- `id`
- `name`
- `modelingMode` (enum): REAL | NOMINAL
- `nominalReturn` (number)
- `inflation` (number)
- `effectiveTaxRate` (number | null) // used only if takeHomeAnnual is null
- `takeHomeAnnual` (number | null)   // preferred: net take-home
- `swr` (number)
- `retirementMonthlySpend` (number)
- `retirementAgeTarget` (number) // for Coast FI computation
- `salaryGrowthOverride` (number | null)
- `includeEmployerMatch` (boolean)
- `equityPolicy` (EquityPolicy)
- `contributionOverrides` (ContributionOverride[], optional) — scenario-only overrides for contribution amounts (e.g. "Max 401k: $23,000")
- `eventOverrides` (Event[], optional) — scenario-only events that apply only when this scenario is active (e.g. "Jillian RSU vest 2027")

### ContributionOverride
- `source` (enum): payroll | outOfPocket | monthlySavings
- `personId` (string, required when source is payroll)
- `accountId` (string)
- `amountAnnual` OR `amountMonthly` OR `percentOfIncome` (same as Contribution)
- `startYear` (number, optional)
- `endYear` (number, optional)
- `startMonth` (number 1–12, optional)
- `endMonth` (number 1–12, optional)

### EquityPolicy
- `defaultWithholdingRate` (number)
- `defaultSalePolicy` (enum): SELL_ALL | SELL_PERCENT | HOLD
- `defaultSellPercent` (number | null)
- `defaultDestinationAccountId` (string | null)

---

## Event (one-time)
- `id`
- `name`
- `year`
- `amount` (number)
- `kind` (enum): INFLOW | OUTFLOW | INVEST | WITHDRAW | TRANSFER
- `accountId` (optional; required for INVEST/WITHDRAW/TRANSFER)
- `notes` (string, optional)

---

## EquityGrant (v1 RSU)
- `id`
- `ownerPersonId`
- `type` (enum): RSU
- `startYear`
- `endYear` (optional)
- `frequency` (enum): MONTHLY | QUARTERLY | ANNUAL
- `sharesPerPeriod` (number) OR `vestingTable` (array of {year, shares})
- `priceAssumption` (PriceAssumption)
- `withholdingRate` (number | null) // overrides scenario default
- `salePolicy` (enum | null)        // overrides scenario default
- `sellPercent` (number | null)
- `destinationAccountId` (string | null)

### PriceAssumption
- `mode` (enum): FIXED | GROWTH
- `fixedPrice` (number, if FIXED)
- `growthRate` (number, if GROWTH)
