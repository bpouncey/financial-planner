# TEST_CASES.md — Parity + Regression Tests (Human-Readable)

Use these to validate the model during development.

## Test 1 — Spreadsheet parity (baseline)
**Goal:** When inputs match the provided Traditional FI/RE sheet, the app reproduces the same outputs.

- Modeling mode: REAL
- Returns: 7% nominal
- Inflation: 3%
- SWR: 3%
- Retirement spend: $8,000/mo
- Start invested: $159,291
- Household salary: $294,000
- Current spend: $6,353/mo
- Notes: This test is primarily for *formula parity*.

**Expected:** App outputs align with spreadsheet within small differences (depending on growth timing convention). See [PARITY_TOLERANCE.md](./PARITY_TOLERANCE.md) for growth convention, tolerance, and regression assertions.

---

## Test 2 — “No disappearing dollars” regression
**Goal:** Prevent the sheet failure mode.

- Enter an adjustment equivalent to -$7,326/mo.
- The app must force classification.

**Expected:** User cannot save until they map it to:
- payroll investing (choose account) OR
- payroll deductions (spending) OR
- taxes OR
- transfer

---

## Test 3 — Payroll investing correctly increases portfolio
**Goal:** Verify that payroll contributions increase account balances.

- Add: 401k employee $2,000/mo to TRADITIONAL account
- Add: HSA $500/mo to HSA account
- No other changes

**Expected:**
- Annual contributions appear in the year table.
- Invested assets end-of-year increase accordingly.
- FI date improves relative to baseline.

---

## Test 4 — One-time event impact
**Goal:** Big purchase reduces assets/spare cash and delays FI.

- Add event: 2029 OUTFLOW $30,000 from CASH (or TAXABLE if chosen)

**Expected:** Net worth dips in 2029; FI date shifts later (or probability reduces in v2).

---

## Test 5 — RSU vesting sold and reinvested
**Goal:** RSU proceeds flow correctly.

- Add RSU: 2027 annual vest net proceeds $50,000 (after withholding)
- Sale policy: SELL_ALL
- Destination: TAXABLE brokerage

**Expected:** Brokerage balance jumps in 2027; FI date improves; cashflow table reflects the inflow and taxes withheld.

---

## Test 6 — Scenario comparison
**Goal:** Compare Base vs Conservative.

- Base: 7% nominal, 3% inflation
- Conservative: 5% nominal, 3% inflation
Everything else equal.

**Expected:** Conservative scenario shows later FI, lower ending balances, and visible delta in compare view.
