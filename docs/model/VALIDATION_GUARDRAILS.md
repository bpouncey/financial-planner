# VALIDATION_GUARDRAILS.md — Warnings, Errors, and Guardrails

## 1) Hard errors (block calculation until resolved)
1. **Unclassified adjustments**
   - Any input that reduces “savings” or take-home must be mapped to:
     - Spending, Taxes, Investing (account), or Transfer.

2. **Missing required relationships**
   - Contribution references non-existent account.
   - Employer match enabled but no deposit account chosen.

3. **Invalid ranges**
   - Negative balances where not allowed (unless explicitly modeling debt in v2).
   - SWR <= 0 or > 0.1 (10%) (guardrail; allow override with confirmation if desired).
   - Inflation/return < -50% or > 50% (guardrail; allow override with confirmation).

---

## 2) Soft warnings (allow calculation, show banner)
1. **Cashflow deficit**
   - Planned spending + investing exceeds take-home by **$X/yr**.

2. **Over-concentration assumption**
   - Real return > 7% or < 0% (flag “aggressive” or “pessimistic”).

3. **Retirement spending mismatch**
   - Retirement spend < current spend (prompt: “Is that intentional?”)

4. **FI milestone ambiguity**
   - If user excludes major accounts from FI assets (e.g., taxable brokerage excluded), show note.

5. **Equity holding risk**
   - If sale policy is HOLD for large equity concentration, show risk note.

---

## 3) Reconciliation checks (must always pass)
### Account reconciliation (per year)
For each account:
`End = Begin + Contributions + EventInflows + Growth - Withdrawals - EventOutflows`

### Household cashflow reconciliation (per year)
If using take-home mode:
`TakeHome + OtherInflows - Spending - OutOfPocketInvesting + NetEventFlows = Surplus/Deficit`

Display Surplus/Deficit explicitly.

---

## 4) UX constraints to prevent spreadsheet pitfalls
- A negative “Monthly Save Adjust” UI control is replaced by a **classification flow**:
  - “This reduction is due to: [Payroll investing] [Payroll deductions] [Taxes] [Transfer]”
- “Annual Saved” is never a primary editable field—it's a computed output.
- The app always displays:
  - total payroll investing
  - total payroll deductions
  - total out-of-pocket investing
  - total spending
