/**
 * Educational content for the Scenarios page.
 * Explains Real vs Nominal modeling and recommended use cases.
 */

export const SCENARIO_GUIDE = {
  /** Toggle label for the collapsible section */
  toggleLabel: "Real vs Nominal — when to use each",

  /** Short intro shown when collapsed */
  intro:
    "Modeling mode changes how income, spending, and wealth are expressed. Both produce equivalent outcomes; they differ in how numbers are presented.",

  /** Main sections for the expanded content */
  sections: [
    {
      title: "What's the difference?",
      content: `**Real** = values in today's dollars (purchasing power). Your salary and net worth are expressed as if inflation never happened — easy to compare across years.

**Nominal** = actual future dollars. You see the raw numbers you'd see on a paycheck or bank statement in that year. Income and spending grow over time with inflation.`,
    },
    {
      title: "Why does income decrease in Real mode with 0% raises?",
      content: `With 0% salary growth, your paycheck stays the same dollar amount every year. But Real mode expresses everything in *today's* dollars. A flat $100k in 2030 has less purchasing power than $100k today — so the model correctly shows your "real" income declining over time.

Your intuition ("income stays same, expenses go up") is the **Nominal** view: income stays flat in dollars, spending inflates. Use Nominal mode to see that framing.`,
    },
    {
      title: "Recommended configurations",
      items: [
        {
          label: "Pessimistic: no raises",
          config: "**Mode:** Nominal · **Salary growth:** 0% (both people)",
          why: "Income stays flat, spending inflates. Best for 'what if we never get raises?'",
        },
        {
          label: "Realistic: historic norm",
          config: "**Mode:** Real · **Salary growth:** 3% (match inflation) · **Salary growth is real:** Yes",
          why: "Everything in today's dollars. Income keeps pace with inflation; numbers stay comparable year over year.",
        },
      ],
    },
    {
      title: "Which mode should I use?",
      content: `**Real** is usually best for planning: all numbers in today's dollars, no mental inflation math. FI year, savings rate, and strategy stay the same regardless of mode — only the presentation differs.`,
    },
  ],
} as const;
