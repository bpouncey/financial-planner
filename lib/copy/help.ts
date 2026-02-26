/**
 * Centralized help content for forms and metrics.
 * Plain-language descriptions for non-experts.
 * Format: { title, description, example? }
 */

export type HelpEntry = {
  title: string;
  description: string;
  example?: string;
};

/** Format HelpEntry for tooltip content (description + optional example). */
export function formatHelpEntry(entry: HelpEntry): string {
  return entry.example
    ? `${entry.description} Example: ${entry.example}.`
    : entry.description;
}

/** Format HelpEntry for tooltip/help display */
export function formatHelpContent(entry: HelpEntry): string {
  return entry.example
    ? `${entry.description} Example: ${entry.example}`
    : entry.description;
}

/** Scenario / form field help */
export const HELP_FORM: Record<string, HelpEntry> = {
  scenarioName: {
    title: "Scenario name",
    description: "A label for this set of assumptions. Use different scenarios to compare outcomes (e.g. conservative vs aggressive).",
    example: "Base, Optimistic, Early retirement",
  },
  modelingMode: {
    title: "Modeling mode",
    description: "Real = values in today's dollars (inflation-adjusted). Nominal = unadjusted future dollars.",
    example: "Use Real for easier planning; Nominal for raw numbers.",
  },
  nominalReturn: {
    title: "Nominal return",
    description: "Expected annual investment return before inflation. Typical range 5–8%. Higher = more aggressive.",
    example: "7% is a common long-term assumption.",
  },
  inflation: {
    title: "Inflation",
    description: "Expected annual inflation rate. Used with Real mode to convert to today's dollars.",
    example: "2–3% is typical.",
  },
  swr: {
    title: "Safe withdrawal rate (SWR)",
    description: "Annual withdrawal rate from invested assets in retirement. Your FI number = annual spend ÷ SWR.",
    example: "4% is the classic rule-of-thumb; 3–3.5% is more conservative.",
  },
  takeHomeAnnual: {
    title: "Take-home (annual)",
    description:
      "After-tax income available for spending and saving. Used when you prefer to pin take-home instead of deriving from gross. Ignored when effective tax rate is set.",
    example: "Use when you have pay stubs and prefer take-home as input.",
  },
  effectiveTaxRate: {
    title: "Effective tax rate",
    description:
      "Average tax rate applied to gross income. Net to checking = gross × (1 − rate) − 401k/IRA contributions − payroll deductions. Gross income is the source of truth; take-home is derived.",
    example: "25% is a rough estimate for many US households.",
  },
  retirementEffectiveTaxRate: {
    title: "Retirement tax rate (%)",
    description:
      "Traditional/401k withdrawals are taxed. Estimate your retirement tax rate (often lower than working years). Used when drawing from Traditional accounts in the withdrawal phase.",
    example: "15% is common for retirees in lower brackets.",
  },
  taxableWithdrawalsTaxRate: {
    title: "Taxable withdrawal tax rate (%)",
    description:
      "Effective tax rate on taxable brokerage withdrawals in retirement. Gains may be taxed as capital gains; this rate approximates the blended impact. Used when drawing from taxable accounts in the withdrawal phase.",
    example: "10% is a rough estimate for LTCG in lower brackets.",
  },
  payrollDeductionsAnnual: {
    title: "Payroll deductions (annual $)",
    description:
      "Scenario-level override for total payroll deductions (health insurance, dental, etc.). When set, replaces the sum of per-person payroll deductions from Setup. Leave blank to use person-level values.",
    example: "6000 = $6,000/year in deductions for this scenario.",
  },
  retirementMonthlySpend: {
    title: "Retirement monthly spend",
    description: "How much you plan to spend per month in retirement. Drives your FI number.",
    example: "FI number = (monthly × 12) ÷ SWR",
  },
  currentMonthlySpend: {
    title: "Current monthly spend",
    description: "Spending before retirement. Optional; used for projection years if different from retirement spend.",
    example: "Leave blank to assume same as retirement spend.",
  },
  retirementAgeTarget: {
    title: "Retirement age target",
    description: "Age at which you plan to retire. Affects projection horizon and salary assumptions.",
    example: "65 is common; early retirement often 50–55.",
  },
  salaryGrowthOverride: {
    title: "Salary growth override",
    description: "Override per-person salary growth for this scenario. Leave blank to use each person's rate.",
    example: "3% = modest raises; 0% = no raises.",
  },
  includeEmployerMatch: {
    title: "Include employer match",
    description: "Whether to model 401k employer match contributions.",
    example: "Enable when you receive a match.",
  },
  stressTestFirstYearReturn: {
    title: "Stress test (first year return %)",
    description:
      "Simulate a market crash in year 1. Override the first year return to see how sequence risk can delay FI. Leave blank for normal returns.",
    example: "-40 = 40% drop in year 1; shows impact of early bear market.",
  },
};

/** Primary dashboard metrics */
export const HELP_METRICS: Record<string, HelpEntry> = {
  fiNumber: {
    title: "FI Number",
    description: "Total invested assets needed to support retirement spending at your chosen withdrawal rate (SWR).",
    example: "FI number = (retirement spend × 12) ÷ SWR",
  },
  fiYear: {
    title: "FI Year",
    description: "First year when invested assets reach the FI number. You could retire in this year.",
    example: "2035 = financially independent in 2035",
  },
  coastFiYear: {
    title: "Coast FI Year",
    description: "Year you could stop contributing and still hit FI (from growth alone). You'd coast to retirement.",
    example: "2030 = stop contributions in 2030; still hit FI by retirement",
  },
  savingsRate: {
    title: "Savings Rate",
    description: "First-year savings ÷ gross income. Higher = faster path to FI.",
    example: "50% savings rate can lead to FI in ~17 years.",
  },
  monteCarloFiYear: {
    title: "FI Year Range (Monte Carlo)",
    description:
      "Simulates many possible market paths with random annual returns. Shows the 25th–75th percentile range of when you might reach FI. Helps illustrate sequence-of-returns risk.",
    example: "2032–2041 (median 2035) = 50% of paths hit FI by 2035; 25% by 2032; 75% by 2041.",
  },
  emergencyFundFundedYear: {
    title: "Emergency fund funded",
    description:
      "First year when your tracked account reaches your emergency fund goal, based on contributions and growth.",
    example: "2028 = emergency fund fully funded by 2028",
  },
};

/** Year-by-year table column headers */
export const HELP_TABLE: Record<string, HelpEntry> = {
  income: {
    title: "Income",
    description: "Gross income from salaries and other sources for the year.",
  },
  taxes: {
    title: "Taxes",
    description: "Estimated taxes for the year (based on your tax mode).",
  },
  spending: {
    title: "Spending",
    description: "Money spent on living expenses (not invested).",
  },
  contrib: {
    title: "Contributions",
    description: "Money added to each account (payroll + out-of-pocket) for the year.",
  },
  growth: {
    title: "Growth",
    description: "Investment gains (or losses) for the year on account balances.",
  },
  endBalance: {
    title: "End balance",
    description: "Account balance at year-end, after contributions and growth.",
  },
  netWorth: {
    title: "Net worth",
    description: "Total of all account balances at year-end.",
  },
  invested: {
    title: "Invested",
    description: "Sum of account balances that count toward FI (excludes accounts marked excluded).",
  },
  withdrawal: {
    title: "Withdrawal",
    description: "Money taken from this account to cover retirement spending.",
    example: "Shown in withdrawal phase when you draw from accounts to fund expenses.",
  },
  withdrawalPhaseTaxes: {
    title: "Withdrawal taxes",
    description:
      "Tax on Traditional/401k/IRA/403(b) withdrawals in retirement. Estimated using your retirement effective tax rate.",
    example: "Often lower than working years since retirement income is typically lower.",
  },
  fundingGap: {
    title: "Funding gap",
    description:
      "The plan cannot fully fund retirement spending from accessible accounts this year. Traditional and 403(b) are restricted until age 59.5; HSA until 65 for non-medical use. Consider a taxable bridge, working until 59.5, or Roth conversions.",
    example: "If you retire at 55 with only Traditional/403(b) savings, these accounts are inaccessible until 59.5.",
  },
};

/** Withdrawal phase (post-FI) help */
export const HELP_WITHDRAWAL: Record<string, HelpEntry> = {
  intro: {
    title: "Withdrawal phase",
    description:
      "Withdrawal phase begins when you hit FI. We draw from taxable first (often best for taxes), then tax-deferred (401k/IRA/403b), then Roth.",
    example: "Taxable brokerage → 401k/IRA/403b → Roth IRA.",
  },
  withdrawalOrder: {
    title: "Withdrawal order",
    description:
      "Order we draw from accounts in retirement. Taxable first often minimizes taxes; Traditional last to defer tax on growth.",
  },
};

/** Account form fields */
export const HELP_ACCOUNTS: Record<string, HelpEntry> = {
  name: {
    title: "Account name",
    description: "A label for this account (e.g. employer 401k, Vanguard taxable).",
  },
  type: {
    title: "Account type",
    description:
      "Cash = savings, checking. Taxable = brokerage. Money Market = liquid, taxable. Traditional 401k / Roth 401k = employer plans (401k limits). Traditional IRA / Roth IRA = individual plans (IRA limits). 403(b) = tax-deferred (similar to 401k). HSA = health savings account.",
  },
  owner: {
    title: "Owner",
    description: "Who owns this account: Person A, Person B, or Joint.",
  },
  startingBalance: {
    title: "Starting balance",
    description: "Current balance in this account at the start of the projection.",
  },
  includedInFIAssets: {
    title: "Include in FI assets",
    description: "Whether this account counts toward your FI number. Uncheck for emergency funds or short-term savings.",
  },
  apy: {
    title: "APY (%)",
    description: "Annual Percentage Yield for this money market account. Growth uses this rate instead of the scenario investment return. Leave blank to use the scenario rate.",
    example: "4.5 = 4.5% APY.",
  },
  isEmployerSponsored: {
    title: "Employer-sponsored",
    description:
      "Check if this is an employer-sponsored plan (401k, 403b, Roth 401k). IRAs are not employer-sponsored. Used to track progress for the FOO Employer Match step.",
  },
};

/** Person / income form fields */
export const HELP_PEOPLE: Record<string, HelpEntry> = {
  name: {
    title: "Name",
    description: "Display name for this person in the planner.",
  },
  baseSalaryAnnual: {
    title: "Gross income (annual)",
    description: "Total pre-tax salary before deductions and taxes.",
  },
  salaryGrowthRate: {
    title: "Salary growth (%)",
    description: "Expected annual raise as a percentage. Applied each year in the projection.",
    example: "Enter 3 for 3% growth.",
  },
  salaryGrowthIsReal: {
    title: "Salary growth is real",
    description: "If true, salary growth is inflation-adjusted. If false, growth is nominal.",
  },
  birthYear: {
    title: "Birth year",
    description: "Used to compute age and retirement timing (e.g. Coast FI year).",
    example: "1990 = age 35 in 2025.",
  },
  payrollDeductionsSpending: {
    title: "Payroll deductions (annual)",
    description: "Money withheld for insurance and other non-investing expenses.",
    example: "Health insurance, dental, etc.",
  },
};

/** Emergency fund goal */
export const HELP_EMERGENCY_FUND: Record<string, HelpEntry> = {
  targetAmount: {
    title: "Target amount",
    description: "How much you want in your emergency fund. The planner tracks when this account will reach that balance.",
    example: "3–6 months of expenses.",
  },
  account: {
    title: "Account to track",
    description: "The account where you're building your emergency fund (e.g. HYSA, savings). Its balance is projected over time.",
  },
};

/** Contribution form fields */
export const HELP_CONTRIBUTIONS: Record<string, HelpEntry> = {
  account: {
    title: "Account",
    description: "The account this contribution goes into.",
  },
  contributorType: {
    title: "Employee vs employer",
    description:
      "Employee contributions are subject to the $23,500 limit (2025); employer contributions count toward the $70,000 combined limit. Use this when you have both types (e.g. 401k match).",
  },
  amountMonthly: {
    title: "Amount ($/mo)",
    description: "Monthly contribution amount. Annual = monthly × 12.",
  },
  amountAnnual: {
    title: "Amount (annual)",
    description: "Annual contribution amount. Optional if monthly is set.",
  },
  percentOfIncome: {
    title: "% of income",
    description: "Contribution as a percentage of gross income. Scales with salary growth year-over-year. Payroll only.",
    example: "15% = invest 15% of gross income into this account.",
  },
  startYear: {
    title: "Start year",
    description: "First year this contribution applies. Leave blank for projection start.",
  },
  endYear: {
    title: "End year",
    description: "Last year this contribution applies. Leave blank for indefinite.",
  },
};

/** Events form fields (one-time inflows/outflows) */
export const HELP_EVENTS: Record<string, HelpEntry> = {
  intro: {
    title: "One-time events",
    description:
      "One-time cash movements that shift net worth. Outflow = money leaving an account (e.g. down payment). Inflow = windfall, bonus, inheritance.",
    example: "House down payment, annual bonus, inheritance.",
  },
  name: {
    title: "Event name",
    description: "A label for this event (e.g. House down payment, Year-end bonus).",
  },
  year: {
    title: "Year",
    description: "The projection year when this event occurs.",
    example: "2029 = event happens in 2029.",
  },
  amount: {
    title: "Amount ($)",
    description: "Dollar amount of the inflow or outflow. Positive number.",
    example: "30000 = $30,000.",
  },
  kind: {
    title: "Type",
    description: "Inflow = money added to an account (windfall, bonus). Outflow = money taken from an account (purchase, down payment).",
  },
  account: {
    title: "Account",
    description: "For outflow: the account money is taken from. For inflow: the account money is added to.",
    example: "Select Cash for windfall; select brokerage for sale proceeds.",
  },
};

/** Equity grants (RSU) form fields */
export const HELP_EQUITY_GRANTS: Record<string, HelpEntry> = {
  intro: {
    title: "RSU grants",
    description:
      "Restricted stock units that vest over time. Net proceeds (after withholding) flow into your chosen account each vest year.",
    example: "2024 grant: 100 shares vesting 25/year over 4 years.",
  },
  owner: {
    title: "Owner",
    description: "The person who receives this RSU grant (from their employer).",
  },
  startYear: {
    title: "Start year",
    description: "First year shares begin vesting.",
    example: "2025 = first vest in 2025.",
  },
  endYear: {
    title: "End year",
    description: "Last year of vesting. Leave blank if vesting continues or is single-year.",
    example: "2028 = last vest in 2028.",
  },
  vestingTable: {
    title: "Vest schedule",
    description: "Year and number of shares that vest. Add a row for each vest date.",
    example: "2025: 25 shares, 2026: 25 shares = 50 total over 2 years.",
  },
  priceMode: {
    title: "Price assumption",
    description: "Fixed = same share price every year. Growth = price grows each year at a rate.",
    example: "Fixed $150; or Growth 5%/yr.",
  },
  fixedPrice: {
    title: "Share price (fixed)",
    description: "Price per share when using fixed mode. Vest value = shares × price.",
    example: "150 = $150/share.",
  },
  growthRate: {
    title: "Growth rate",
    description: "Annual price growth when using growth mode. Price compounds each year.",
    example: "0.05 = 5% per year.",
  },
  withholdingRate: {
    title: "Withholding rate",
    description: "Fraction of vest value withheld for taxes (0–100%). Net proceeds = vest value × (1 − withholding).",
    example: "0.4 = 40% withheld, you receive 60%.",
  },
  destinationAccount: {
    title: "Destination account",
    description: "Where net proceeds (after withholding) are deposited.",
    example: "Taxable brokerage or cash.",
  },
};

/** Equity grants (RSU) form fields */
export const HELP_EQUITY: Record<string, HelpEntry> = {
  intro: {
    title: "RSU / equity grants",
    description:
      "Restricted Stock Units (RSUs) that vest over time. Net proceeds (after withholding) flow to a chosen account.",
    example: "4-year vest, $50k/year to brokerage.",
  },
  name: {
    title: "Grant name",
    description: "A label for this grant (e.g. 2024 refresh, Sign-on).",
  },
  owner: {
    title: "Owner",
    description: "The person who receives this equity grant.",
  },
  startYear: {
    title: "Start year",
    description: "First year of the vesting schedule.",
  },
  endYear: {
    title: "End year",
    description: "Last year of vesting. Optional; leave blank if same as last vest entry.",
  },
  vestingTable: {
    title: "Vesting schedule",
    description: "Year and number of shares vesting each year. Add a row per vest date.",
    example: "2025: 100 shares, 2026: 100 shares = 200 shares over 2 years.",
  },
  priceMode: {
    title: "Price assumption",
    description: "Fixed = same price per share every year. Growth = price grows each year by the given rate.",
  },
  fixedPrice: {
    title: "Fixed price per share",
    description: "Assumed stock price for all vest dates when using fixed pricing.",
  },
  growthRate: {
    title: "Price growth rate",
    description: "Annual growth rate for stock price when using growth mode.",
    example: "10% = price increases 10% each year.",
  },
  withholdingRate: {
    title: "Withholding rate",
    description: "Fraction of vest value withheld for taxes (0–100%). Net proceeds = gross value × (1 - rate).",
    example: "40% withholding → 60% to your account.",
  },
  destinationAccount: {
    title: "Destination account",
    description: "Where net proceeds after withholding are deposited (e.g. taxable brokerage, cash).",
  },
};

/** Financial Order of Operations (FOO) - The Money Guy Show */
export const HELP_FOO: Record<string, HelpEntry> = {
  intro: {
    title: "Financial Order of Operations",
    description:
      "The Money Guy Show's 9-step roadmap for building wealth. Each dollar is deployed to its highest and best use—maximizing return while minimizing risk and taxes. The goal: save 25% of gross income (a 'Financial Mutant').",
    example: "Complete Steps 1–6 before funding taxable brokerage (Step 7).",
  },
  step1: {
    title: "Step 1: Deductibles Covered",
    description: "Save enough cash to cover your highest health or auto insurance deductible. Prevents going into high-interest debt for emergencies.",
  },
  step2: {
    title: "Step 2: Employer Match",
    description: "Contribute exactly enough to your 401(k)/403(b) to get the maximum employer match. It's a guaranteed 50–100% return on day one.",
  },
  step3: {
    title: "Step 3: High-Interest Debt",
    description: "Aggressively pay off credit cards, payday loans, and high-interest personal loans. Generally anything in double digits is an emergency.",
  },
  step4: {
    title: "Step 4: Emergency Reserves",
    description: "Build 3–6 months of living expenses in a liquid account. 3 months for dual-income stable jobs; 6 months for single income or volatile work.",
  },
  step5: {
    title: "Step 5: Roth IRA & HSA",
    description: "Max out Roth IRA and HSA. HSA is triple tax-advantaged: deductible contributions, tax-free growth, tax-free withdrawals for medical expenses.",
  },
  step6: {
    title: "Step 6: Max-Out Retirement",
    description: "Return to your 401(k)/403(b) and increase contributions to the federal limit. Use pre-tax if in a high bracket; Roth if young and in a low bracket.",
  },
  step7: {
    title: "Step 7: Hyperaccumulation",
    description: "If Steps 1–6 are maxed and you're still below 25% savings, fund a taxable brokerage. Builds the Three-Bucket strategy: pre-tax, tax-free, and after-tax.",
  },
  step8: {
    title: "Step 8: Prepaid Future Expenses",
    description: "Save for children's college (529) or other large known expenses. Rule: secure your own retirement first. You can borrow for college; not for retirement.",
  },
  step9: {
    title: "Step 9: Low-Interest Debt Pre-payment",
    description: "Pay off mortgage and low-interest student/car loans last. Math favors investing, but debt-free retirement has psychological benefits.",
  },
};

/** Household setup fields */
export const HELP_HOUSEHOLD: Record<string, HelpEntry> = {
  name: {
    title: "Household name",
    description: "A label for this planning scenario (e.g. Smith Family, My Plan).",
  },
  startYear: {
    title: "Start year",
    description: "First year of the projection. Usually the current year or next.",
  },
};
