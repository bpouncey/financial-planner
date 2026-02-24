"use client";

import { useHouseholdStore } from "@/stores/household";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { formatHelpContent, HELP_FORM } from "@/lib/copy/help";

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

export function AssumptionsPanel() {
  const { household, activeScenarioId } = useHouseholdStore();

  const scenario =
    household.scenarios.find((s) => s.id === activeScenarioId) ??
    household.scenarios[0] ?? null;

  if (!scenario) return null;

  const taxLabel =
    scenario.takeHomeAnnual != null
      ? `Take-home ${formatCurrency(scenario.takeHomeAnnual)}`
      : scenario.effectiveTaxRate != null
        ? `Effective rate ${formatPercent(scenario.effectiveTaxRate)}`
        : "—";

  const salaryGrowthLabel =
    scenario.salaryGrowthOverride != null
      ? formatPercent(scenario.salaryGrowthOverride)
      : "Per-person";

  const assumptions = [
    {
      label: "Modeling mode",
      value: scenario.modelingMode,
      helpKey: "modelingMode" as const,
    },
    {
      label: "Nominal return",
      value: formatPercent(scenario.nominalReturn),
      helpKey: "nominalReturn" as const,
    },
    {
      label: "Inflation",
      value: formatPercent(scenario.inflation),
      helpKey: "inflation" as const,
    },
    {
      label: "SWR",
      value: formatPercent(scenario.swr),
      helpKey: "swr" as const,
    },
    {
      label: "Tax mode",
      value: taxLabel,
      helpKey:
        scenario.takeHomeAnnual != null ? "takeHomeAnnual" : "effectiveTaxRate",
    },
    {
      label: "Salary growth",
      value: salaryGrowthLabel,
      helpKey: "salaryGrowthOverride" as const,
    },
  ];

  return (
    <details className="group rounded-lg border border-border bg-surface-elevated">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 text-sm font-medium text-content [&::-webkit-details-marker]:hidden">
        <span>Assumptions</span>
        <span className="text-content-muted transition group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="border-t border-border px-6 py-4">
        <p className="mb-4 text-xs text-content-muted">
          These assumptions drive your projection. Change them in Scenarios.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assumptions.map((a) => (
            <div key={a.label} className="flex items-center gap-1.5">
              <span className="text-sm text-content-muted">
                {a.label}:
              </span>
              <span className="text-sm font-medium text-content">
                {a.value}
              </span>
              <HelpTooltip
                content={formatHelpContent(HELP_FORM[a.helpKey])}
                side="top"
              />
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
