# MODEL_RULES.md — FI/RE Planner Modeling Rules (Source of Truth)

## 0) Guiding principle
**No dollars disappear.** Every cashflow adjustment must be classified as exactly one of:
- **Spending** (reduces cash available)
- **Investing** (increases a specific account balance)
- **Taxes** (reduces cash available)
- **Transfer** (moves between accounts; net worth unchanged)

If an input would reduce “savings” without being assigned to spending/tax/investing/transfer, the app must block save and ask for classification.

---

## 1) Time basis & units
- v1 default time step: **Annual** (year-by-year)
- Contributions may be entered as **monthly** or **annual**; the engine normalizes to annual.
- One-time events can be year-based (v1). (Monthly events optional v1.1)

---

## 2) Real vs nominal modeling
The app supports two modes:

### A) Real-dollar mode (default)
- User enters *today’s dollars*.
- **Real return** is computed as: `real_return ≈ (1 + nominal_return)/(1 + inflation) - 1`
  - (Approximation acceptable: `nominal - inflation` if you choose simplicity, but keep it consistent.)
- Retirement spending target stays constant (today’s dollars).

### B) Nominal-dollar mode
- User enters values in today’s dollars initially, then:
- Spending is inflated each year by the inflation assumption.
- Nominal return is applied directly.

---

## 3) Cashflow identity (annual)
For each year `y`, the model must reconcile:

`NetCashAvailable = NetTakeHome + OtherNetInflows - Spending - Taxes - OutOfPocketInvesting - OneTimeOutflows + OneTimeInflows`

Where:
- **NetTakeHome** is either:
  - **Mode 1 (recommended):** user-provided net take-home (already after payroll deductions & payroll investing), or
  - **Mode 2:** `GrossIncome - (EffectiveTaxRate * GrossIncome) - PayrollDeductions - PayrollInvesting`
- **PayrollInvesting** must **increase account balances** (401k/403b/HSA/etc.)
- **PayrollDeductions** are **spending** (insurance, etc.), unless the user classifies as taxes or transfers.

The app should show a warning if `NetCashAvailable < 0`:
> “Your plan spends/invests $X more than take-home this year.”

---

## 4) Accounts & flows
### Account types (v1)
- Cash
- Taxable Brokerage
- Traditional pre-tax (401k/403b/IRA)
- Roth (Roth IRA / Roth 401k)
- HSA
- Equity (RSUs tracked as value if holding)

Each account has:
- starting balance
- contribution schedule
- growth assumption bucket (scenario return)
- accessibility rules (optional bridge check)

### Account accessibility (age-based)
Withdrawal-phase logic restricts which accounts can be drawn from based on the oldest person's age (derived from `birthYear`):

- **CASH, TAXABLE, ROTH:** Always accessible.
- **TRADITIONAL, 403B:** Accessible at age 60+ (IRS rule of 59.5; model uses 60 = first full penalty-free year).
- **HSA:** Accessible at 65+ for non-medical withdrawals.
- **When no birth year is set:** All account types are accessible (legacy behavior).
- **When accessible funds are insufficient:** The engine records a withdrawal shortfall; the UI surfaces it as a funding-gap indicator.

### Transfers
Transfers are explicit and do not affect total net worth.

---

## 5) Growth calculation
For each account in year `y`:
1) BeginBalance
2) + Contributions (and event inflows)
3) + Growth
4) - Withdrawals (and event outflows)
= EndBalance

**v1 growth convention (choose one and document it):**
- **End-of-year contributions:** Growth applied to `BeginBalance` only.
- **Mid-year contributions (recommended):** Apply growth to `BeginBalance + 0.5*Contributions` for a closer approximation.

---

## 6) FI, Coast FI, and targets
### FI Number
- `FI_Number = AnnualRetirementSpend / SWR`
- AnnualRetirementSpend = `RetirementMonthlySpend * 12`

### Traditional FI milestone
- Achieved when **Invested Assets** (user-select which accounts count) >= FI_Number

### Coast FI milestone
Coast FI checks whether *existing invested assets* can reach FI_Number by a chosen retirement age without further contributions:
- `FutureValue = CurrentInvestedAssets * (1 + real_return)^(years_to_target)`
- Achieved when `FutureValue >= FI_Number`

---

## 7) Equity / RSU rules (v1: RSUs)
Each RSU entry has:
- vest schedule (date/year, frequency, shares)
- price assumption (fixed or growth rate)
- withholding % at vest
- sale policy: sell all / sell % / hold
- destination for proceeds: cash or taxable brokerage (v1)

At each vest:
- `vested_value = shares_vested * share_price`
- `withholding = vested_value * withholding_rate`
- `net_proceeds = vested_value - withholding`

Then:
- If sell: move `net_proceeds` to destination account
- If hold: add `vested_value` to an Equity account (mark-to-model value)

---

## 8) Minimum UI/validation rules
- Any negative “save adjustment” must be classified as:
  - Payroll investing (choose account) OR
  - Payroll deductions (spending) OR
  - Taxes OR
  - Transfer
- The year-by-year table must always satisfy:
  - per-account reconciliation
  - household cashflow reconciliation

---

## 9) Defaults (sensible starting points)
- Modeling mode: **Real**
- SWR: **3%**
- Returns: **7% nominal**
- Inflation: **3%**

---

## 10) Model assumptions and limitations
The v1 model intentionally simplifies several real-world factors:

- **Tax:** Flat effective rate or user-provided take-home. No marginal brackets, capital gains rates, Roth vs Traditional treatment at withdrawal, or RMDs. For high earners this is a meaningful simplification.

- **Sequence-of-returns risk:** The model uses a single constant return rate. Real portfolios are path-dependent; this model can overestimate FI confidence in volatile scenarios.

- **Long-horizon:** Tests validate up to ~40 years. Floating-point compounding errors are small but untested over 50+ years.
