# PRD: Interactive FI/RE Planner Web App (Cursor Build) — v2

> **Source-of-truth for modeling:** `docs/model/MODEL_RULES.md`  
> **Spreadsheet role:** reference only (mapping + parity tests). The app must never “borrow” ambiguous Excel fields without classification.

---

## 1) Summary
Build a web app that replaces a one-dimensional Excel FI/RE calculator with an interactive, scenario-based planning tool that:
- models **realistic cashflow + investing behavior** (net pay, payroll deductions, payroll investing, multiple accounts)
- supports multiple scenarios (Base / Conservative / Aggressive + custom)
- handles nuanced assets (taxable brokerage, HSA, Roth, pre-tax, employer match, equity/RSU vesting)
- visualizes the **roadmap to FI/RE** (timeline, milestones, bridges, and sensitivity)
- is **explainable**: every projection shows where the money went (income → taxes → spending → investing → growth)

**Goal:** Make FI projections accurate, interpretable, and decision-useful—not a single “magic year”.

---

## 2) Problem
The current spreadsheet can be misleading because:
- it collapses real-world flows into a single bucket (income → taxes → “saved” → portfolio)
- it’s easy to misclassify payroll investing vs payroll deductions vs spending
- it hides account nuances (access rules, vesting schedules, match timing)
- one wrong assumption can shift outcomes by decades (e.g., dollars “disappear” when a negative adjustment reduces savings but isn’t added to invested balance)

Users need a model that clearly shows:
- **what’s happening** (cashflow + accounts)
- **why results change** (scenario diffs)
- **what levers matter** (spend, invest rate, returns, equity events)

---

## 3) Goals & Non-goals
### Goals (v1)
1. **No disappearing dollars (HARD REQUIREMENT):** Every adjustment must map to exactly one of: spending, taxes, investing-to-account, or transfer.
2. **Accuracy first:** Explicit cashflow + contributions by account; taxes modeled simply but consistently.
3. **Scenario planning:** Toggle assumptions (returns, inflation, spend, salary growth, contribution changes, big purchases).
4. **Account-aware projections:** Track balances by account type; support (optional) access/bridge check.
5. **Equity/RSU support:** Vest schedules + withholding + sell/hold + destination behavior.
6. **Visual roadmap:** Charts + milestone markers (Coast FI, FI, Bridge-funded optional).
7. **Explainability:** Year-by-year table + attribution (contributions vs growth vs events).

### Non-goals (v1)
- Full bracketed tax engine with deductions and state rules (beyond effective-rate / take-home modes)
- Transaction-level brokerage tracking / cost basis
- Monte Carlo simulation (v2)
- Multi-household collaboration (v2)

---

## 4) Target Users
- Individuals/couples using spreadsheets for FI planning who want scenario toggles and better realism.
- Users with mixed assets: 401(k)/403(b), IRA/Roth, HSA, taxable brokerage, equity compensation.

---

## 5) Key Use Cases
1. **Baseline plan:** Enter balances, take-home, spending, contributions; see FI + Coast FI outcomes.
2. **Scenario toggles:** Compare Base vs Conservative vs Aggressive; see “what changed?” driver breakdown.
3. **Account strategy:** “Max tax-advantaged first” vs “brokerage heavy” and see timeline impact.
4. **Equity event:** Add RSU vesting next year; choose sell policy; see effect on FI year and net worth path.
5. **Big purchases:** Car replacement, down payment, renovation—see impact on milestones.
6. **Bridge check (optional):** Retire at X; verify accessible funds cover Y years until 59½.

---

## 6) Core Concepts (must be explicit in UI)
The app must distinguish:
- **Net take-home pay** (what hits checking)
- **Payroll deductions that are spending** (insurance, etc.)
- **Payroll investing** (401k/403b/HSA via payroll)
- **Out-of-paycheck investing** (brokerage transfers)
- **Transfers** (between accounts; do not change net worth)

This prevents the spreadsheet failure mode where dollars reduce “saved” but never enter the portfolio.

---

## 7) Inputs (Data Model)
> Canonical schema is in `docs/model/DATA_SCHEMA.md` (human-readable) and optionally `lib/types/zod.ts` (Zod).

### Household
- Name
- Start year (default current year)
- Person A / Person B

### Person
- Identity: name, DOB/current age
- Income model: salary, growth rate (real or nominal), bonus (optional)
- Payroll:
  - payroll investing by account (401k/403b/HSA)
  - payroll deductions that reduce take-home (insurance etc.)

### Accounts (v1)
- Cash
- Taxable brokerage
- Traditional (401k/403b/IRA)
- Roth (Roth IRA / Roth 401k)
- HSA
- Equity (RSUs as modeled value if held)

Each account includes:
- owner (A/B/Joint)
- starting balance
- contribution schedule
- growth bucket
- include/exclude toggle for “FI assets” (default behavior defined below)
- accessibility flags (optional)

### Spending
- Current monthly spending (from bank/CC)
- Payroll-spend adjustments (insurance etc.)
- Retirement spending target (monthly)
- Inflation assumption (scenario)

### Taxes (two modes)
- **Mode A:** Effective all-in tax rate (simple)
- **Mode B (recommended):** User-provided annual take-home (bypasses tax calc)

### One-time events
- Year
- Category: inflow | outflow | invest | withdraw | transfer
- Amount
- Optional: source/destination account

### Equity (v1: RSU-focused)
- vest schedule (frequency + shares)
- price assumption (fixed or growth)
- withholding %
- sale policy (sell all / sell % / hold)
- destination (cash or taxable)

---

## 8) Outputs (What the app shows)
### Primary metrics
- FI number (retirement spend / SWR)
- Coast FI year/age
- Traditional FI year/age
- Savings rate (computed)
- Contribution vs growth attribution

### Visuals
1. Net worth over time (stacked by account type)
2. Invested assets over time + FI target line
3. Contribution vs growth (annual bars)
4. Scenario compare chart (2–3 scenarios)
5. Roadmap timeline (nice-to-have in v1.2+)

### Tables
- Year-by-year table:
  - income, taxes (if modeled), spending, net cash surplus/deficit
  - contributions by account
  - growth by account
  - ending balances

### Explainability panels
- “What changed?” diff when switching scenarios
- “Top 3 drivers” (spend, contribution rate, returns/equity)

---

## 9) Definitions & Conventions (must be decided and documented)
### 9.1 Growth timing convention (choose ONE for v1)
Pick one and document it prominently (to avoid “why doesn’t it match Excel?” issues):
- **Option 1 (simple):** End-of-year contributions earn no growth in that year
- **Option 2 (recommended):** Mid-year convention: growth applies to `begin + 0.5 * contributions`

**Recommendation:** Use **mid-year convention** for more realism; parity tests may differ slightly from Excel depending on its approach.

### 9.2 What counts as “FI assets” (default)
Default include:
- Taxable brokerage
- Traditional retirement
- Roth
- HSA (toggle on; default ON if you intend HSA as retirement asset)
Default exclude:
- Cash (toggle on; default OFF unless user wants it)

The UI must allow toggling inclusions per account.

### 9.3 Real vs nominal modeling
- Real mode (default): inputs in today’s dollars; compute real return using `(1+nominal)/(1+inflation)-1`
- Nominal mode: inflate spending each year; apply nominal return

---

## 10) Calculation Engine (Spec)
### Time step
- v1: annual (fast, simple)
- v1.1: optional monthly for equity vesting granularity

### Annual flow
For each year:
1. Compute gross income (salary + bonus + one-time inflows + equity proceeds if sold)
2. Taxes:
   - Mode A: effective_rate × gross
   - Mode B: take-home provided; taxes implicit
3. Determine spending (and payroll spending adjustments)
4. Determine contributions:
   - payroll investing → increases accounts
   - out-of-paycheck investing → increases accounts
   - employer match (if enabled) → increases account
5. Update each account:
   - begin + contributions + growth - withdrawals + net events = end
6. Compute totals and milestone checks:
   - FI: invested_assets >= FI_number
   - Coast FI: current_assets compounded to target age >= FI_number

### Equity (RSU v1)
At each vest period:
- vested_value = shares * price
- withholding = vested_value * withholding_rate
- net_proceeds = vested_value - withholding
Apply sale policy:
- sell → move net_proceeds to destination account
- hold → track in Equity account value

---

## 11) Scenarios
### Scenario object
- returns (nominal), inflation
- SWR, retirement spend target
- salary growth
- tax mode (effective rate vs take-home)
- toggles: include employer match; equity policy defaults

### Scenario UX
- Scenario list in left sidebar
- Duplicate scenario
- Compare view (select 2–3 scenarios)
- Diff panel: “What changed + effect on FI year”

---

## 12) Validation & Guardrails (v1)
> Canonical rules in `docs/model/VALIDATION_GUARDRAILS.md`

**Hard requirement:** Any negative “adjustment” must be classified as spending/taxes/investing/transfer.  
Warnings:
- spending + investing exceeds take-home by $X/yr
- retirement spend < current spend (confirm)
- aggressive return assumptions flagged
- equity concentration flagged if holding

---

## 13) Parity & Migration (NEW)
### Spreadsheet role
The spreadsheet is used for:
- mapping current inputs to app fields
- parity checks for baseline calculations

**It is NOT the modeling authority.** If Excel logic contradicts `MODEL_RULES.md`, the app follows `MODEL_RULES.md`.

### Mapping checklist (v1)
- Identify all input cells on the Traditional FI sheet
- Map to:
  - take-home vs effective tax mode
  - current spend vs payroll spend adjustments
  - contributions by account (explicit)
  - starting balances by account (even if Excel uses one bucket)

### Parity test suite
Create 3–6 test fixtures (see `docs/tests/TEST_CASES.md`), including:
- baseline parity
- “no disappearing dollars” regression
- payroll investing increases portfolio
- RSU proceeds flow to destination

---

## 14) Tech Stack (Cursor-friendly)
- Next.js (App Router) + TypeScript
- Tailwind
- Zod (schemas)
- Zustand/Jotai (state)
- Recharts (charts)
- localStorage/IndexedDB (v1)
- Supabase (optional v1.5)

Suggested architecture:
- `lib/model/` pure calculation engine
- `lib/types/` schemas
- `components/charts/`, `components/forms/`
- `app/(app)/dashboard`, `app/(app)/scenarios`, etc.

---

## 15) Milestones
### MVP
- Household setup
- Real mode
- Tax mode: effective rate OR take-home
- Accounts: cash, taxable, traditional, roth, hsa
- Contributions by account
- Dashboard charts + year-by-year table
- Scenarios: base + duplicate/edit
- Guardrails: no disappearing dollars + cashflow deficit warning

### v1.1
- One-time events
- Simple employer match
- Better warnings + reconciliation checks UI

### v1.2
- RSU module
- Scenario compare view + diff panel

### v1.5
- Persistence + import/export JSON

### v2
- Monte Carlo
- Bracketed tax engine
- Withdrawal strategy + Roth conversion ladder

---

## 16) Acceptance Criteria (updated)
1. **No disappearing dollars:** Every adjustment maps to spending/taxes/investing/transfer; app blocks calculation otherwise.
2. **Reconciliation:** Year-by-year table reconciles per account (begin + inflows + growth − outflows = end).
3. **Scenario explainability:** Switching scenarios shows what changed and the effect on FI year.
4. **Parity:** With matching inputs, app reproduces spreadsheet baseline within expected tolerance (depending on growth timing convention).
5. **Equity:** RSU vesting flows correctly into cash/brokerage based on policy.

---

## 17) Future: Roadmap View (nice-to-have)
Timeline view with:
- Coast FI, FI, equity events, big purchases
- adjustable retirement age slider + bridge check indicator
