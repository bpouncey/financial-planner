/**
 * Compare two scenarios and produce human-readable "top drivers" for the What Changed panel.
 */

import type { Scenario } from "@/lib/types/zod";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export interface ScenarioDriverChange {
  label: string;
  from: string;
  to: string;
}

function formatValue(
  key: keyof Scenario,
  value: unknown
): string {
  if (value == null) return "—";
  switch (key) {
    case "nominalReturn":
    case "inflation":
    case "swr":
    case "effectiveTaxRate":
    case "salaryGrowthOverride":
    case "retirementEffectiveTaxRate":
    case "traditionalWithdrawalsTaxRate":
    case "stressTestFirstYearReturn":
      return typeof value === "number" ? formatPercent(value) : String(value);
    case "retirementMonthlySpend":
    case "currentMonthlySpend":
    case "takeHomeAnnual":
    case "payrollDeductionsAnnual":
      return typeof value === "number" ? formatCurrency(value) : String(value);
    case "retirementAgeTarget":
      return typeof value === "number" ? `${value} years` : String(value);
    case "modelingMode":
      return String(value);
    case "includeEmployerMatch":
      return value ? "Yes" : "No";
    case "retireWhen":
      return value === "AGE" ? "At target age only" : value === "FI" ? "When FI reached" : "Age or FI (whichever first)";
    default:
      return String(value);
  }
}

const DRIVER_LABELS: Partial<Record<keyof Scenario, string>> = {
  modelingMode: "Modeling mode",
  nominalReturn: "Nominal return",
  inflation: "Inflation",
  effectiveTaxRate: "Effective tax rate",
  takeHomeAnnual: "Take-home (annual)",
  swr: "Safe withdrawal rate (SWR)",
  retirementMonthlySpend: "Retirement monthly spend",
  currentMonthlySpend: "Current monthly spend",
  retirementAgeTarget: "Retirement age target",
  salaryGrowthOverride: "Salary growth override",
  includeEmployerMatch: "Include employer match",
  retirementStartYear: "Retirement start year",
  retireWhen: "Retirement trigger",
  retirementEffectiveTaxRate: "Retirement tax rate",
  traditionalWithdrawalsTaxRate: "Traditional withdrawal tax rate",
  stressTestFirstYearReturn: "Stress test first-year return",
  payrollDeductionsAnnual: "Payroll deductions (annual)",
};

/** Keys to compare (ordered by impact / user relevance). */
const DRIVER_KEYS: (keyof Scenario)[] = [
  "modelingMode",
  "nominalReturn",
  "inflation",
  "swr",
  "effectiveTaxRate",
  "takeHomeAnnual",
  "retirementMonthlySpend",
  "currentMonthlySpend",
  "retirementAgeTarget",
  "salaryGrowthOverride",
  "includeEmployerMatch",
  "retirementStartYear",
  "retireWhen",
  "retirementEffectiveTaxRate",
  "traditionalWithdrawalsTaxRate",
  "stressTestFirstYearReturn",
  "payrollDeductionsAnnual",
];

function getTaxModeLabel(scenario: Scenario): string {
  if (scenario.takeHomeAnnual != null) {
    return `Take-home ${formatCurrency(scenario.takeHomeAnnual)}`;
  }
  if (scenario.effectiveTaxRate != null) {
    return `Effective rate ${formatPercent(scenario.effectiveTaxRate)}`;
  }
  return "—";
}

/**
 * Diff two scenarios and return a list of changed drivers with human-readable labels.
 */
export function diffScenarios(
  prev: Scenario,
  next: Scenario
): ScenarioDriverChange[] {
  const changes: ScenarioDriverChange[] = [];
  let taxHandled = false;

  for (const key of DRIVER_KEYS) {
    // Tax mode: combine effectiveTaxRate + takeHomeAnnual into one entry
    if (key === "effectiveTaxRate" || key === "takeHomeAnnual") {
      if (taxHandled) continue;
      taxHandled = true;
      const prevTax = getTaxModeLabel(prev);
      const nextTax = getTaxModeLabel(next);
      if (prevTax !== nextTax) {
        changes.push({
          label: "Tax mode",
          from: prevTax,
          to: nextTax,
        });
      }
      continue;
    }

    const prevVal = prev[key as keyof Scenario];
    const nextVal = next[key as keyof Scenario];
    const prevNorm =
      prevVal === undefined || prevVal === null ? null : prevVal;
    const nextNorm =
      nextVal === undefined || nextVal === null ? null : nextVal;

    if (prevNorm !== nextNorm) {
      const label = DRIVER_LABELS[key] ?? key;
      changes.push({
        label,
        from: formatValue(key, prevVal),
        to: formatValue(key, nextVal),
      });
    }
  }

  return changes;
}
