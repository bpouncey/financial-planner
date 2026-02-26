# Accuracy Data Contract (per-scenario run)

## Cashflow identity (clarification)
The reconciliation rule (Sources − Uses = 0) is an internal accounting check. We never force income = expenses or require a zero-based budget. cashSavingsChange captures surplus (positive) or deficit (negative). reconciliationDelta != 0 indicates a model bug, not a user error; never adjust user inputs to fix it.

## Computed outputs (per year)
Required fields:
- grossIncome
- taxesPayroll
- taxesAdditional
- netToChecking
- spending
- contribEmployeePreTax
- contribEmployeeRoth
- contribEmployer
- contribAfterTax
- rsuVestValue, rsuWithholding, rsuNetProceeds
- withdrawalsTraditional, withdrawalsRoth, withdrawalsTaxable
- withdrawalTaxes
- withdrawalsTraditionalGross (gross amount withdrawn from traditional; equals withdrawalsTraditional when gross-up is used)
- withdrawalTaxesPaid (taxes on withdrawals; equals withdrawalTaxes)
- unallocatedSurplus (accumulation-phase balancing sink; 0 when disabled)
- bucketUsedTaxable, bucketUsedTaxDeferred, bucketUsedRoth (1 if that bucket had withdrawals, 0 otherwise)
- portfolioStart, portfolioGrowth, portfolioEnd
- reconciliationDelta

## Validation object (per scenario run)
Return alongside results:
- errors[] (blocking)
- warnings[] (non-blocking)
- assumptions[] (things user should verify)

## Blocking errors (minimum set)
- CASHFLOW_NOT_RECONCILED: reconciliationDelta != 0 (beyond rounding threshold)
- CASHFLOW_RECONCILIATION_BREAKDOWN: when reconciliationDelta != 0, includes period, net income, contributions, spending, taxes, unallocated surplus
- INPUT_DEFINITION_CONFLICT: takeHomeDefinition conflicts with provided inputs
- EMPLOYER_MATCH_DISABLED_BUT_PRESENT: includeEmployerMatch=false but contribEmployer > 0
- RETIREMENT_TAX_ZERO: traditional withdrawals > 0 but withdrawalTaxes == 0 (beyond rounding)
- MISSING_CASH_HUB: takeHomeDefinition=NET_TO_CHECKING but no account with type CHECKING exists
- WITHDRAWAL_TAX_UNFUNDED: withdrawal taxes computed but not funded (legacy path; should not occur after gross-up)

## Warnings (minimum set)
- RSU_WITHHOLDING_DEFAULT_USED
- TAX_RATES_EFFECTIVE_SIMPLIFICATION
- AUTO_OVERFLOW_ROUTING_ENABLED
- FI_NOT_MET_AT_RETIREMENT_AGE (if retireWhen includes AGE)

## Assumptions (minimum set)
- Inflation definition (used when salaryGrowthMode = REAL)
- Tax model level (effective vs bracket-ish)
- RSU sellStrategy interpretation (Phase 1 vs Phase 2)