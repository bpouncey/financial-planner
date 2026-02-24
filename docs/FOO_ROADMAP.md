# Financial Order of Operations (FOO) Roadmap

**App roadmap aligned with [The Money Guy Show's Financial Order of Operations](financial-knowledge/money-guys-roadmap.md).**

This document maps each FOO step to the app's data model, existing features, and planned enhancements. The goal is to guide users through the FOO while leveraging the app's projection engine.

---

## Overview: The 9 Steps

| Step | FOO Step | App Status | Priority |
|------|----------|------------|----------|
| 1 | Deductibles Covered | Not modeled | P2 |
| 2 | Employer Match | ✅ Supported | — |
| 3 | High-Interest Debt | Not modeled | P2 |
| 4 | Emergency Reserves | ✅ Supported | — |
| 5 | Roth IRA & HSA | ✅ Supported | — |
| 6 | Max-Out Retirement | ✅ Supported | — |
| 7 | Hyperaccumulation (Brokerage) | ✅ Supported | — |
| 8 | Prepaid Future Expenses | Partial | P1 |
| 9 | Low-Interest Debt Pre-payment | Partial | P1 |

---

## Step-by-Step Mapping

### Step 1: Deductibles Covered

**FOO Goal:** Save enough cash to cover your highest health or auto insurance deductible.

**App Mapping:**
- **Data model:** No explicit "deductible goal" today. Closest: `EmergencyFundGoal` (target amount + account).
- **Accounts:** `CASH` or `MONEY_MARKET` with `includedInFIAssets: false`.
- **Contributions:** `monthlySavings` or `outOfPocketInvesting` into a cash account.

**Gap:** No dedicated "deductible goal" type. Users can approximate by:
1. Adding a CASH account for "deductible fund"
2. Setting `emergencyFundGoal` with a lower target (deductible amount) as a first milestone
3. Or tracking manually outside the app

**Recommendation (P2):** Add optional `DeductibleGoal` (target amount, account) similar to `EmergencyFundGoal`. Low complexity; can reuse emergency-fund UI patterns.

---

### Step 2: Employer Match

**FOO Goal:** Contribute exactly enough to get the maximum employer match.

**App Mapping:**
- **Data model:** `EmployerMatchModel` on `Person.payroll` — `matchPercent`, `matchCapPercentOfSalary`, `depositToAccountId`.
- **Contributions:** `payrollInvesting` (Contribution[]) with `accountId` pointing to Traditional/403(b).
- **Scenario:** `includeEmployerMatch` toggle.

**Status:** ✅ Fully supported. User sets payroll contributions to match cap; employer match flows into the same account.

**Enhancement (P3):** Help copy or onboarding tip: "Contribute at least X% to capture full employer match" (computed from match rules).

---

### Step 3: High-Interest Debt

**FOO Goal:** Aggressively pay off credit cards, payday loans, high-interest personal loans.

**App Mapping:**
- **Data model:** No debt tracking. Events can model one-time payoffs (`OUTFLOW`), but no ongoing debt balance or interest.
- **Behavioral:** FOO says to prioritize debt payoff *before* Steps 4–9. The app assumes users are past this step or handling it separately.

**Gap:** No debt accounts, no interest accrual, no "debt payoff" contribution type.

**Recommendation (P2):** Add optional `Debt` model: `balance`, `interestRate`, `minimumPayment`, `accountId` (source of payoff). Project payoff timeline. Could block or warn if user has high-interest debt and is funding Step 5+ accounts. Lower priority than core FOO visualization.

---

### Step 4: Emergency Reserves

**FOO Goal:** Build 3–6 months of living expenses in a liquid account.

**App Mapping:**
- **Data model:** `EmergencyFundGoal` — `targetAmount`, `accountId`.
- **Accounts:** `CASH` or `MONEY_MARKET` (HYSA) with `includedInFIAssets: false`.
- **Contributions:** `monthlySavings` into the tracked account.
- **Dashboard:** `emergencyFundFundedYear` metric in `PrimaryMetricsPanel`; `HELP_METRICS.emergencyFundFundedYear`.

**Status:** ✅ Fully supported. User sets target (e.g., 6 months expenses) and account; app projects when it’s funded.

**Enhancement (P3):** Suggest 3 vs 6 months based on income stability (single vs dual income, freelance) — requires additional user input.

---

### Step 5: Roth IRA and HSA

**FOO Goal:** Max out Roth IRA and HSA (triple tax-advantaged).

**App Mapping:**
- **Accounts:** `ROTH`, `HSA` account types.
- **Contributions:** `payrollInvesting` (HSA via payroll) and/or `outOfPocketInvesting` (Roth IRA).
- **Limits:** Not enforced in-app; user must set amounts to match IRS limits.

**Status:** ✅ Supported. User adds Roth and HSA accounts, sets contributions.

**Enhancement (P3):** Display IRS contribution limits for current year as reference; optional "max this account" quick-fill.

---

### Step 6: Max-Out Retirement Options

**FOO Goal:** Return to 401(k)/403(b) and contribute up to federal limit.

**App Mapping:**
- **Accounts:** `TRADITIONAL`, `403B`.
- **Contributions:** `payrollInvesting` with `amountAnnual` or `amountMonthly`.
- **Scenario:** `includeEmployerMatch` for employer contributions.

**Status:** ✅ Supported. User increases payroll contributions to max.

**Enhancement (P3):** Show IRS 401(k)/403(b) limits; "max" quick-fill.

---

### Step 7: Hyperaccumulation (Taxable Brokerage)

**FOO Goal:** If still below 25% savings rate after Steps 1–6, fund taxable brokerage (and/or real estate).

**App Mapping:**
- **Accounts:** `TAXABLE` (brokerage).
- **Contributions:** `outOfPocketInvesting` into taxable account.
- **Three-Bucket Strategy:** App already models Pre-tax (Traditional/403b), Tax-free (Roth/HSA), After-tax (Taxable). See [brokerage strategy doc](financial-knowledge/money-guys-brokerage-account-strategy.md).

**Status:** ✅ Supported. User adds taxable account and contributions.

**Enhancement (P3):** Help copy explaining "Step 7: Hyperaccumulation" and three-bucket tax diversification.

---

### Step 8: Prepaid Future Expenses

**FOO Goal:** Save for children's college (529) or other large known expenses. *Rule: Secure your own retirement first.*

**App Mapping:**
- **Data model:** No 529 or education-specific account type. Could use:
  - `CASH` or `TAXABLE` with `includedInFIAssets: false` for 529-like savings
  - `Event` with `OUTFLOW` for future college payment
- **Gap:** No dedicated 529 account; no projection of education savings growth separate from FI assets.

**Recommendation (P1):** Add optional `FutureExpenseGoal` (e.g., 529): `name`, `targetAmount`, `targetYear`, `accountId`. Track progress similar to emergency fund. Ensure messaging: "Fund your retirement (Steps 1–7) before Step 8."

---

### Step 9: Low-Interest Debt Pre-payment

**FOO Goal:** Pay off mortgage, low-interest student loans, car loans. Last because math favors investing, but debt-free retirement has psychological benefits.

**App Mapping:**
- **Data model:** No mortgage or loan tracking. `Event` with `OUTFLOW` can model one-time payoff.
- **Gap:** No ongoing mortgage balance, no amortization, no "payoff by retirement" projection.

**Recommendation (P1):** Add optional `Loan` model: `balance`, `interestRate`, `paymentMonthly`, `payoffYear` (or compute). Show "debt-free by year X" if user targets payoff before retirement. Lower priority than Step 8 for most users.

---

## Rules of Thumb (Supporting Content)

The Money Guys' rules can be surfaced as help content or optional validators:

| Rule | App Support | Notes |
|------|-------------|-------|
| **20/3/8 (Car)** | Events | User adds car purchase as OUTFLOW. Optional validator: warn if payment &gt; 8% of income. |
| **Housing (25%)** | Manual | No housing-specific field. User could add event for down payment; affordability is manual. |
| **Wealth Multiplier** | Help copy | Add to onboarding or help: "Dollar at 20 → 88× by 65; at 30 → 23×." |
| **Messy Middle** | — | Conceptual; FOO order helps users navigate. |

---

## Implementation Phases

### Phase 1: FOO-Aware UI (No Schema Changes)

- [ ] Add **FOO Step Guide** component: collapsible 9-step checklist with short descriptions, linked to relevant setup sections.
- [ ] Add **FOO help entries** to `lib/copy/help.ts` for each step (e.g., `HELP_FOO`).
- [ ] Extend **RoadmapTimeline** to optionally show FOO step milestones (e.g., "Step 4 complete" when emergency fund funded).
- [ ] Add **25% savings rate** indicator: show when user hits "Financial Mutant" target; flag if below.

**Files:** `RoadmapTimeline.tsx`, `lib/copy/help.ts`, new `FooStepGuide.tsx`, `PrimaryMetricsPanel.tsx`

---

### Phase 2: Step 8 & 9 Data Model (Schema Additions)

- [ ] Add `FutureExpenseGoal` (529 / prepaid expenses): `targetAmount`, `targetYear`, `accountId`, `name`.
- [ ] Add `FutureExpenseGoalForm` in Setup (similar to `EmergencyFundGoalForm`).
- [ ] Add `Loan` (optional): `balance`, `interestRate`, `paymentMonthly`, `payoffTargetYear` (optional).
- [ ] Add `LoanForm` and project payoff year in engine.
- [ ] Engine: compute `futureExpenseFundedYear`, `loanPayoffYear` for dashboard.

**Files:** `lib/types/zod.ts`, `docs/model/DATA_SCHEMA.md`, `lib/model/engine.ts`, new forms

---

### Phase 3: Step 1 & 3 (Deductibles, Debt)

- [ ] Add `DeductibleGoal` (optional): `targetAmount`, `accountId`.
- [ ] Add `Debt` model and forms.
- [ ] Engine: debt payoff projection; deductibles funded year.
- [ ] FOO guide: warn if high-interest debt exists and user is funding Step 5+.

**Files:** Schema, engine, forms, validation

---

### Phase 4: Polish & Rules of Thumb

- [ ] IRS limit references (401k, Roth, HSA) in contribution forms.
- [ ] 20/3/8 car validator (optional warning).
- [ ] Wealth multiplier and Messy Middle copy in help/onboarding.
- [ ] "Max this account" quick-fills where applicable.

---

## Verification Checklist

- [ ] Emergency fund goal → `emergencyFundFundedYear` matches projection.
- [ ] Employer match flows into correct account when `includeEmployerMatch` is on.
- [ ] Roth, HSA, Traditional, Taxable contributions all project correctly.
- [ ] Roadmap timeline shows FI, Coast FI, emergency fund funded, target retirement.
- [ ] FOO step guide is accurate and links to correct setup sections.
- [ ] 25% savings rate computed and displayed when applicable.

---

## Summary

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | FOO guide, help copy, roadmap enhancements, 25% indicator | Small |
| **Phase 2** | Future expense goal (529), loan model | Medium |
| **Phase 3** | Deductible goal, debt model | Medium |
| **Phase 4** | IRS limits, rules of thumb, polish | Small |

The app already supports Steps 2, 4, 5, 6, and 7 well. Phase 1 adds FOO framing and guidance. Phases 2–3 fill gaps for Steps 1, 3, 8, and 9. Phase 4 adds supporting content and validators.
