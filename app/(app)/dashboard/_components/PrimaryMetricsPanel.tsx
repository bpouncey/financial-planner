"use client";

import { useMemo } from "react";
import { useHouseholdStore } from "@/stores/household";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { formatHelpContent, HELP_METRICS } from "@/lib/copy/help";
import { runMonteCarlo, type ProjectionResult } from "@/lib/model/engine";

function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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

export function PrimaryMetricsPanel() {
  const { household, activeScenarioId, projection } = useHouseholdStore();

  const scenario =
    household.scenarios.find((s) => s.id === activeScenarioId) ??
    household.scenarios[0] ?? null;

  const monteCarloResult = useMemo(() => {
    if (!scenario || !projection) return null;
    return runMonteCarlo(household, scenario, 100, 50);
  }, [household, scenario, projection]);

  if (!projection) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-6">
        <p className="text-sm text-content-muted">
          No projection available. Complete household setup to see metrics.
        </p>
      </div>
    );
  }

  const { fiNumber, fiYear, coastFiYear, savingsRate } = projection;
  const currency = household.currency ?? "USD";

  const monteCarloValue =
    monteCarloResult &&
    monteCarloResult.fiYear25 != null &&
    monteCarloResult.fiYear50 != null &&
    monteCarloResult.fiYear75 != null
      ? monteCarloResult.pathsHitFi > 0
        ? `${monteCarloResult.fiYear25}–${monteCarloResult.fiYear75} (median ${monteCarloResult.fiYear50})`
        : "—"
      : "—";

  const monteCarloSubtext =
    monteCarloResult && monteCarloResult.pathsHitFi > 0
      ? `${monteCarloResult.pathsHitFi}/100 paths hit FI in 50 years`
      : monteCarloResult
        ? "No paths hit FI in horizon"
        : "25th–75th percentile range with random returns";

  const emergencyFundGoal = household.emergencyFundGoal;
  const emergencyFundFundedYear =
    emergencyFundGoal?.targetAmount &&
    emergencyFundGoal?.accountId &&
    getEmergencyFundFundedYear(
      projection,
      emergencyFundGoal.accountId,
      emergencyFundGoal.targetAmount
    );

  const baseMetrics = [
    {
      label: "FI Number",
      value: formatCurrency(fiNumber, currency),
      subtext: "Invested assets needed to retire at SWR",
      helpKey: "fiNumber" as const,
    },
    {
      label: "FI Year",
      value: fiYear != null ? String(fiYear) : "—",
      subtext: "Year invested assets reach FI number",
      helpKey: "fiYear" as const,
    },
    {
      label: "Coast FI Year",
      value: coastFiYear != null ? String(coastFiYear) : "—",
      subtext: "Year you could stop contributing and still hit FI",
      helpKey: "coastFiYear" as const,
    },
    {
      label: "Savings Rate",
      value: formatPercent(savingsRate),
      subtext: "First-year savings ÷ gross income",
      helpKey: "savingsRate" as const,
    },
    {
      label: "FI Year Range (Monte Carlo)",
      value: monteCarloValue,
      subtext: monteCarloSubtext,
      helpKey: "monteCarloFiYear" as const,
    },
  ];

  const emergencyFundMetric =
    emergencyFundGoal?.targetAmount && emergencyFundGoal?.accountId
      ? {
          label: "Emergency fund funded",
          value:
            emergencyFundFundedYear != null
              ? String(emergencyFundFundedYear)
              : "—",
          subtext: `Target ${formatCurrency(emergencyFundGoal.targetAmount, currency)}`,
          helpKey: "emergencyFundFundedYear" as const,
        }
      : null;

  const metrics = emergencyFundMetric
    ? [...baseMetrics, emergencyFundMetric]
    : baseMetrics;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated">
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-content">
                {m.label}
              </p>
              <HelpTooltip
                content={formatHelpContent(HELP_METRICS[m.helpKey])}
                side="top"
              />
            </div>
            <p className="text-xl font-semibold tracking-tight text-content">
              {m.value}
            </p>
            <p className="text-xs text-content-muted">
              {m.subtext}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
