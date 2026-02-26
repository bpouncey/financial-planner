# Accuracy MVP Spec (Finance Projection Engine)

## Non-negotiables (must hold every year)
### Cashflow identity
For each projection year t:

Sources:
- netToChecking (cash actually deposited to checking)
- otherNetInflows (RSU net proceeds, bonuses net, side income net, etc.)

Uses:
- spending
- afterTaxContribs (cash contributions from checking to accounts)
- cashSavingsChange (delta in cash/checking/savings)
- taxPaymentsOutsidePayroll (if any)

Rule: Sources − Uses = 0 (within rounding). If not, show a blocking error with a delta + suggested fixes.

**Clarification — what this is and isn't:**
- The identity is an internal accounting check. It ensures our model doesn't silently create or destroy money.
- We never force income = expenses. We never require a zero-based budget.
- cashSavingsChange is the residual: when income > expenses, surplus goes to cash (positive); when income < expenses, deficit draws down cash (negative).
- reconciliationDelta != 0 indicates a bug in our implementation (e.g. double-counting, missing flow), not a user error.
- Never adjust user inputs (spending, income, contributions) to make the identity hold. Surface the error; fix the model.

Reference: "Cashflow identity (must hold every year)" and reconciliation guidance.
(Plan: cashflow identity + reconciliation)  ✅

---

## Phase 1 accuracy fixes (implement in this order)

### 1) Make takeHomeAnnual unambiguous (eliminate double-counting)
Add: takeHomeDefinition = "NET_TO_CHECKING" | "AFTER_TAX_ONLY" | "OVERRIDE"

Always compute (export these every year):
- grossIncome
- employeePreTaxContribs
- employeeRothContribs
- employerContribs
- taxes
- netToChecking

Behavior:
- NET_TO_CHECKING: takeHomeAnnual is the net cash deposited to checking. Do NOT subtract payroll contributions/taxes again in cashflow.
- AFTER_TAX_ONLY: takeHomeAnnual is after-tax pay before (employee) contributions; netToChecking is computed after subtracting payroll contributions.
- OVERRIDE: allow user override of netToChecking; show warnings if override conflicts with computed components.

Migration rule:
- Existing scenarios default to NET_TO_CHECKING unless already explicitly modeled as gross-to-net.

Must show a validation banner when input combinations are inconsistent.

---

### 2) Cashflow reconciliation check + optional overflow routing
Compute:
reconciliationDelta =
  netToChecking
  + otherNetInflows
  - spending
  - afterTaxContribs
  - cashSavingsChange
  - taxPaymentsOutsidePayroll

If reconciliationDelta != 0:
- blocking error: “Cashflow doesn’t reconcile by $X.”
- suggested fix list (double-counted contributions, missing brokerage deposit, etc.)

Optional: if autoFixOverflow enabled and reconciliationDelta > 0
- route overflow to "Taxable Brokerage (Overflow)" contribution.

---

### 3) RSU modeling (realistic: income + withholding + net deposit)
Model as 2-step event per year:
1) At vest:
   vestValue = sharesVested * priceAtVest
   Add vestValue to W2Income (for tax purposes)

2) Withholding + net proceeds:
   withholding = vestValue * withholdingRate
   netProceeds = vestValue - withholding
   Deposit netProceeds to destinationAccountId (typically taxable brokerage)

Add knobs:
- withholdingRate (default reasonable; user editable)
- destinationAccountId
- sellStrategy: "SELL_ALL" | "SELL_TO_COVER" | "HOLD" (cap gains can be Phase 2)

Config consistency:
- If RSU price mode is GROWTH, priceAtVest must grow annually.

---

### 4) Salary growth must actually apply (clarify nominal vs real)
Replace boolean with:
- salaryGrowthMode: "NOMINAL" | "REAL"

Rules:
- NOMINAL: nominal salary grows by salaryGrowthRate
- REAL: real salary is constant in today’s dollars; nominal salary grows by inflation

---

### 5) Retirement withdrawal taxes cannot be zero (MVP effective rates)
Add:
- traditionalWithdrawalsTaxRate (effective; user editable)
- rothWithdrawalsTaxRate = 0
- taxableWithdrawalsTaxRate (0 for MVP OR simple cap-gains approximation)

Export:
- withdrawalsTraditional, withdrawalsRoth, withdrawalsTaxable
- withdrawalTaxes

---

### 6) Employer match toggle enforcement
If includeEmployerMatch = false:
- employer contribution lines are excluded (and validation must show what’s included).

---

### 7) Retirement trigger + FI transparency
Add:
- retireWhen: "AGE" | "FI" | "EITHER"

If AGE triggers retirement but FI not met:
- show shortfall banner: “At retirement age, portfolio supports $X/yr at SWR; target spend is $Y/yr.”

Show in UI:
- FI = annualRetirementSpend / SWR
- What’s included/excluded in “invested” for FI test.

---

## Definition of Done (Accuracy MVP)
- Every year reconciles (no silent missing cash).
- RSUs treated as income at vest and net proceeds are deposited.
- Retirement withdrawals incur taxes where appropriate.
- Salary growth behaves as specified.
- Employer match toggle works.
- UI shows assumptions + warnings and exports them with results.