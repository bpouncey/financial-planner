"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useHouseholdStore } from "@/stores/household";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { formatHelpContent, HELP_FOO } from "@/lib/copy/help";
import type { Household, Scenario } from "@/lib/types/zod";
import type { ProjectionResult } from "@/lib/model/engine";

type StepStatus = "complete" | "in-progress" | "not-tracked";

interface FooStep {
  step: number;
  title: string;
  goal: string;
  action: string;
  setupLink: string;
  setupLabel: string;
  getStatus: (ctx: {
    household: Household;
    scenario: Scenario | null;
    projection: ProjectionResult | null;
  }) => StepStatus;
}

function getEmergencyFundFundedYear(
  projection: ProjectionResult,
  accountId: string,
  targetAmount: number
): number | null {
  const row = projection.yearRows.find(
    (r) => (r.endingBalances[accountId] ?? 0) >= targetAmount
  );
  return row?.year ?? null;
}

function hasContributionsToAccount(
  household: Household,
  accountId: string
): boolean {
  for (const p of household.people) {
    const match = p.payroll.payrollInvesting?.some(
      (c) => c.accountId === accountId && (c.amountAnnual ?? c.amountMonthly ?? c.percentOfIncome ?? 0) > 0
    );
    if (match) return true;
  }
  const oop = household.outOfPocketInvesting ?? [];
  const monthly = household.monthlySavings ?? [];
  return (
    oop.some((c) => c.accountId === accountId && (c.amountAnnual ?? c.amountMonthly ?? c.percentOfIncome ?? 0) > 0) ||
    monthly.some((c) => c.accountId === accountId && (c.amountAnnual ?? c.amountMonthly ?? c.percentOfIncome ?? 0) > 0)
  );
}

const FOO_STEPS: FooStep[] = [
  {
    step: 1,
    title: "Deductibles Covered",
    goal: "Keep financial potholes from becoming disasters.",
    action: "Save enough cash to cover your highest health or auto insurance deductible.",
    setupLink: "/setup",
    setupLabel: "Accounts & Monthly savings",
    getStatus: () => "not-tracked",
  },
  {
    step: 2,
    title: "Employer Match",
    goal: "Do not leave free money on the table.",
    action: "Contribute enough to your 401(k)/403(b) to get the maximum employer match.",
    setupLink: "/setup",
    setupLabel: "Payroll investing & Employer match",
    getStatus: ({ household, scenario }) => {
      if (!scenario?.includeEmployerMatch) return "in-progress";
      const employerSponsoredAccounts = household.accounts.filter(
        (a) =>
          (a.type === "TRADITIONAL_401K" || a.type === "403B") &&
          (a.isEmployerSponsored !== false)
      );
      if (employerSponsoredAccounts.length === 0) return "in-progress";
      const employerAccountIds = new Set(employerSponsoredAccounts.map((a) => a.id));
      const hasPayrollToEmployerPlan = household.people.some((p) =>
        (p.payroll.payrollInvesting ?? []).some((c) => {
          if (!employerAccountIds.has(c.accountId)) return false;
          return (c.amountAnnual ?? c.amountMonthly ?? c.percentOfIncome ?? 0) > 0;
        })
      );
      return hasPayrollToEmployerPlan ? "complete" : "in-progress";
    },
  },
  {
    step: 3,
    title: "High-Interest Debt",
    goal: "Stop paying the stupid tax.",
    action: "Aggressively pay off credit cards, payday loans, and high-interest personal loans.",
    setupLink: "/setup",
    setupLabel: "Events (for payoff tracking)",
    getStatus: () => "not-tracked",
  },
  {
    step: 4,
    title: "Emergency Reserves",
    goal: "Protect your Army of Dollar Bills from life's storms.",
    action: "Build 3–6 months of living expenses in a liquid account.",
    setupLink: "/setup",
    setupLabel: "Emergency fund goal",
    getStatus: ({ household, projection }) => {
      const goal = household.emergencyFundGoal;
      if (!goal?.targetAmount || !goal?.accountId) return "in-progress";
      if (!projection) return "in-progress";
      const fundedYear = getEmergencyFundFundedYear(
        projection,
        goal.accountId,
        goal.targetAmount
      );
      return fundedYear != null ? "complete" : "in-progress";
    },
  },
  {
    step: 5,
    title: "Roth IRA & HSA",
    goal: "Maximize tax-free growth.",
    action: "Fund Roth IRA and/or HSA up to legal limits. HSA is triple tax-advantaged.",
    setupLink: "/setup",
    setupLabel: "Accounts & Contributions",
    getStatus: ({ household }) => {
      const rothOrHsa = household.accounts.filter(
        (a) => a.type === "ROTH_401K" || a.type === "ROTH_IRA" || a.type === "HSA"
      );
      if (rothOrHsa.length === 0) return "in-progress";
      const hasContribs = rothOrHsa.some((a) =>
        hasContributionsToAccount(household, a.id)
      );
      return hasContribs ? "complete" : "in-progress";
    },
  },
  {
    step: 6,
    title: "Max-Out Retirement",
    goal: "Lower taxes and build retirement core.",
    action: "Return to 401(k)/403(b) and increase contributions to federal limit.",
    setupLink: "/setup",
    setupLabel: "Payroll investing",
    getStatus: ({ household }) => {
      const tradOr403b = household.accounts.filter(
        (a) => a.type === "TRADITIONAL_401K" || a.type === "403B"
      );
      if (tradOr403b.length === 0) return "in-progress";
      const hasContribs = tradOr403b.some((a) =>
        hasContributionsToAccount(household, a.id)
      );
      return hasContribs ? "complete" : "in-progress";
    },
  },
  {
    step: 7,
    title: "Hyperaccumulation",
    goal: "Reach 25% savings rate; build the Three-Bucket strategy.",
    action: "Fund taxable brokerage (and/or real estate) if Steps 1–6 are maxed.",
    setupLink: "/setup",
    setupLabel: "Accounts & Out-of-pocket investing",
    getStatus: ({ household }) => {
      const taxable = household.accounts.find((a) => a.type === "TAXABLE");
      if (!taxable) return "in-progress";
      return hasContributionsToAccount(household, taxable.id)
        ? "complete"
        : "in-progress";
    },
  },
  {
    step: 8,
    title: "Prepaid Future Expenses",
    goal: "Fund abundance goals without sacrificing retirement.",
    action: "Save for children's college (529) or other large known expenses. Secure your retirement first.",
    setupLink: "/setup",
    setupLabel: "Accounts & Events",
    getStatus: () => "not-tracked",
  },
  {
    step: 9,
    title: "Low-Interest Debt Pre-payment",
    goal: "Debt freedom and peace of mind.",
    action: "Pay off mortgage and low-interest student/car loans. Last because math favors investing.",
    setupLink: "/setup",
    setupLabel: "Events",
    getStatus: () => "not-tracked",
  },
];

function StatusBadge({ status }: { status: StepStatus }) {
  switch (status) {
    case "complete":
      return (
        <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          Complete
        </span>
      );
    case "in-progress":
      return (
        <span className="inline-flex items-center rounded-full bg-info/15 px-2 py-0.5 text-xs font-medium text-info">
          In progress
        </span>
      );
    case "not-tracked":
      return (
        <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs font-medium text-content-muted">
          Manual
        </span>
      );
  }
}

export function FooStepGuide() {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const { household, planProjection } = useHouseholdStore();

  const planScenarioId =
    household.planScenarioId ?? household.scenarios[0]?.id ?? null;
  const planScenario =
    planScenarioId != null
      ? household.scenarios.find((s) => s.id === planScenarioId) ??
        household.scenarios[0] ??
        null
      : null;

  const stepsWithStatus = useMemo(
    () =>
      FOO_STEPS.map((s) => ({
        ...s,
        status: s.getStatus({
          household,
          scenario: planScenario,
          projection: planProjection,
        }),
      })),
    [household, planScenario, planProjection]
  );

  const completeCount = stepsWithStatus.filter(
    (s) => s.status === "complete"
  ).length;
  const savingsRate = planProjection?.savingsRate ?? 0;
  const isFinancialMutant = savingsRate >= 0.25;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-content">
            Financial Order of Operations
          </h2>
          <HelpTooltip
            content={formatHelpContent(HELP_FOO.intro)}
            side="top"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-content-muted">
            {completeCount} of 9 steps
          </span>
          {planProjection && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isFinancialMutant
                  ? "bg-success/15 text-success"
                  : "bg-surface-elevated text-content-muted"
              }`}
            >
              {isFinancialMutant ? "25%+ savings ✓" : `${(savingsRate * 100).toFixed(1)}% savings`}
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface-elevated">
        <div className="divide-y divide-border">
          {stepsWithStatus.map((step) => {
            const isExpanded = expandedStep === step.step;
            return (
              <div key={step.step} className="first:rounded-t-lg last:rounded-b-lg">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStep(isExpanded ? null : step.step)
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                        step.status === "complete"
                          ? "bg-success text-success-foreground"
                          : step.status === "in-progress"
                            ? "bg-info/20 text-info"
                            : "border border-border bg-surface text-content-muted"
                      }`}
                    >
                      {step.status === "complete" ? "✓" : step.step}
                    </span>
                    <span className="font-medium text-content">
                      {step.title}
                    </span>
                    <StatusBadge status={step.status} />
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-content-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-border bg-surface/30 px-4 py-3">
                    <span className="font-medium text-content-muted">
                      Goal:
                    </span>{" "}
                    <span className="text-sm text-content">{step.goal}</span>
                    <p className="mt-2 text-sm text-content">{step.action}</p>
                    <Link
                      href={step.setupLink}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      Configure in Setup →
                      <span className="text-content-muted font-normal">
                        ({step.setupLabel})
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
