# PARITY_TOLERANCE.md — Growth Convention and Parity Test Tolerance

Used for Test 1 (spreadsheet parity) and regression validation.

---

## Growth Convention (per MODEL_RULES §5)

The engine uses **mid-year contributions**:

- Growth base = `BeginBalance + 0.5 × Contributions`
- Growth = growth base × real (or nominal) return
- End balance = Begin + Contributions + Growth

**Alternative (end-of-year):** Some spreadsheets apply growth only to `BeginBalance`. That produces **slightly lower** ending balances when contributions exist, because contributions earn no growth in year 1.

---

## Tolerance vs Spreadsheet

If the reference spreadsheet uses **end-of-year** growth:

- With **no contributions** (Test 1 baseline): results match exactly.
- With **contributions**: app will show ~0.5× contribution × return more growth per year than end-of-year. Over many years this compounds.

**Tolerance for parity test:**

- Dollar amounts: **±$1** (2 decimal places)
- Percentages: **3 decimal places**
- FI year: **exact** when FI is reached; otherwise `null`

---

## Test 1 Fixture (exact inputs)

| Input | Value |
|-------|-------|
| Modeling mode | REAL |
| Nominal return | 7% |
| Inflation | 3% |
| SWR | 3% |
| Retirement spend | $8,000/mo |
| Start invested | $159,291 |
| Household salary | $294,000 |
| Current spend | $6,353/mo |

---

## Expected Outputs (mid-year convention)

| Output | Expected |
|--------|----------|
| FI number | $3,200,000 |
| Real return | ≈ 3.88% |
| Year 1 invested assets | ≈ $165,473 |
| Year 5 invested assets | ≈ $192,719 |

---

## Verification

Run: `npm test -- lib/model/engine.test.ts`

The parity test asserts these values within tolerance. If the engine or growth convention changes, update this doc and the test expectations.
