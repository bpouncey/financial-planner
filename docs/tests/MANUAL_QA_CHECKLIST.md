# Manual QA Checklist — FI/RE Planner v1 MVP

Use this checklist to validate the app before release. Per plan Phase 7.

---

## Prerequisites

- App running: `npm run dev`
- Start from a fresh session (refresh to reset in-memory state)

---

## 1. Test 1 — Spreadsheet parity (baseline)

**Goal:** Reproduce outputs that align with the Traditional FI/RE spreadsheet (within growth-convention tolerance).

### 1.1 Enter Test 1 fixture inputs


| Input            | Value                 | Where to set                                   |
| ---------------- | --------------------- | ---------------------------------------------- |
| Modeling mode    | REAL                  | Scenarios → Mode                               |
| Nominal return   | 7%                    | Scenarios → Nominal return (%)                 |
| Inflation        | 3%                    | Scenarios → Inflation (%)                      |
| SWR              | 3%                    | Scenarios → SWR (%)                            |
| Retirement spend | $8,000/mo             | Scenarios → Retirement monthly spend           |
| Start invested   | $159,291              | Setup → Add account → Starting balance         |
| Household salary | $294,000              | Setup → Person A/B base salary (sum = 294,000) |
| Current spend    | $6,353/mo             | Scenarios → Current monthly spend              |
| Take-home        | ~220k–230k (estimate) | Scenarios → Take-home (annual $)               |


**Steps:**

1. **Setup**
  - Household name, start year (current year).
  - Person A: base salary (e.g. $294,000 total or split across A/B).
  - Person B: $0 if single earner.
  - Add one account: type TAXABLE (or TRADITIONAL), starting balance **$159,291**, `includedInFIAssets` ON.
  - If using payroll investing: link contributions to the account.
  - Set take-home so that: taxes ≈ gross − take-home (e.g. ~$70k taxes for ~$224k take-home).
2. **Scenarios**
  - Mode: Real.
  - Nominal return: 7%, Inflation: 3%, SWR: 3%.
  - Retirement monthly spend: 8000.
  - Current monthly spend: 6353.
  - Tax mode: Take-home; enter estimated annual take-home.

### 1.2 Verify FI / Coast FI and table reconcile

- **Primary metrics panel:** FI number ≈ $3.2M (`$96,000 / 0.03`).
- **FI year:** A plausible year (e.g. ~2035–2045 depending on contributions).
- **Coast FI year:** Shown when applicable.
- **Savings rate:** Non-zero and reasonable.
- **Year-by-year table:**
  - For each account: **End = Begin + Contributions + Growth** (no withdrawals in MVP).
  - First row Begin = starting balance; later rows Begin = previous row End.
  - Net worth = sum of all account ending balances.
  - Invested assets = sum of `includedInFIAssets` account balances.

---

## 2. Guardrails

### 2.1 Cashflow deficit warning

- **Trigger:** Take-home < spending + out-of-pocket investing (e.g. by > $1,000/yr).
  - Set take-home to a low value (e.g. $50,000).
  - Keep current spend ~$76k and/or add out-of-pocket investing so total outflow > take-home.
- **Expected:** Amber warning banner: *"Plan spends $X more than take-home this year"*.
- **Where:** Setup, Scenarios, Dashboard (ValidationBanner).

### 2.2 Aggressive returns warning

- **Trigger:** Nominal return > 7% (e.g. set to 8% or 10%).
- **Expected:** Amber warning: *"Real return > 7% is aggressive; consider conservative case"*.
- **Where:** Setup, Scenarios, Dashboard.

### 2.3 Retirement spend < current spend warning

- **Trigger:** Retirement monthly spend < current monthly spend (e.g. retirement $5,000, current $6,353).
- **Expected:** Amber warning: *"Retirement spend < current spend—is that intentional?"*.
- **Where:** Setup, Scenarios, Dashboard.

### 2.4 Hard errors (block calculation)

- **Missing account ref:** Add payroll or out-of-pocket contribution without selecting an account.
- **Expected:** Red error banner: *"Select an account for each payroll contribution"* or similar.
- **Invalid SWR:** Set SWR to 0% or 15%.
- **Expected:** Red error: *"SWR must be between 0 and 10%"*.
- **Invalid rates:** Set return or inflation to -60% or 60%.
- **Expected:** Red error: *"Return and inflation must be between -50% and 50%"*.

---

## 3. Table reconciliation

- Pick any year in the year-by-year table.
- For each account: verify **End = Begin + Contributions + Growth**.
  - Begin for year N = End for year N−1 (or starting balance for first year).
  - No events in MVP, so no withdrawals or event flows.
- **Net worth** = sum of all account ending balances for that year.
- **Invested** = sum of ending balances for accounts with `includedInFIAssets` ON.

---

## 4. Charts update on scenario change

- Create two scenarios (e.g. Base and duplicate as "Conservative").
- Set different inputs (e.g. Base 7% return, Conservative 5% return).
- Go to **Dashboard**.
- Note: Net worth curve, Invested assets + FI target line, primary metrics.
- Click **Conservative** in sidebar scenarios.
- **Expected:** Charts, year-by-year table, and primary metrics panel update immediately to Conservative values (later FI, lower ending balances).

---

## 5. Scenario list actions

- **Duplicate:** Hover scenario → click duplicate icon → new scenario appears with “(copy)”.
- **Delete:** With 2+ scenarios, hover → click delete → scenario removed; active switches if needed.
- **Keep at least one:** Delete disabled when only one scenario remains.
- **Active selection:** Click scenario name → Dashboard/Scenarios reflect selected scenario.

---

## 6. Quick smoke test path

1. Setup: Add Person A ($100k salary), add TAXABLE account ($50k start).
2. Scenarios: Take-home $75k, retirement $5k/mo, current $4k/mo.
3. Dashboard: Projection runs; metrics, charts, table visible.
4. Duplicate scenario → rename to “Conservative” → lower return to 5%.
5. Switch scenarios → verify Dashboard updates.
6. Trigger cashflow deficit (lower take-home) → warning appears.
7. Fix → warning disappears.

---

## Sign-off


| Step                      | Date | Pass |
| ------------------------- | ---- | ---- |
| Test 1 parity             |      | ☐    |
| Guardrails (all)          |      | ☐    |
| Table reconcile           |      | ☐    |
| Charts on scenario change |      | ☐    |
| Scenario list             |      | ☐    |
| Quick smoke               |      | ☐    |


