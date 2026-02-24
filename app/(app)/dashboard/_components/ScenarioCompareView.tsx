"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useHouseholdStore } from "@/stores/household";
import { runProjection, type ProjectionResult } from "@/lib/model/engine";
import { downloadCompareJson } from "@/lib/utils/export-compare";

const MAX_SCENARIOS = 3;
const COMPARE_COLORS = [
  "var(--primary)",
  "var(--info)",
  "var(--accent)",
] as const;

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

function escapeDataKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

export function ScenarioCompareView() {
  const { household } = useHouseholdStore();
  const scenarios = household.scenarios;

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const ids = scenarios.slice(0, MAX_SCENARIOS).map((s) => s.id);
    return ids;
  });

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SCENARIOS) return prev;
      return [...prev, id];
    });
  };

  const projections = useMemo(() => {
    const result: { scenarioId: string; scenarioName: string; projection: ProjectionResult }[] = [];
    for (const id of selectedIds) {
      const scenario = scenarios.find((s) => s.id === id);
      if (scenario) {
        const projection = runProjection(household, scenario);
        result.push({ scenarioId: id, scenarioName: scenario.name, projection });
      }
    }
    return result;
  }, [household, scenarios, selectedIds]);

  const investedData = useMemo(() => {
    if (projections.length === 0) return [];
    const years = new Set<number>();
    for (const p of projections) {
      for (const row of p.projection.yearRows) years.add(row.year);
    }
    const yearList = Array.from(years).sort((a, b) => a - b);
    return yearList.map((year) => {
      const row: Record<string, number | string | undefined> = { year };
      projections.forEach(({ scenarioId, projection }) => {
        const r = projection.yearRows.find((x) => x.year === year);
        row[escapeDataKey(scenarioId)] = r?.investedAssets;
      });
      return row;
    });
  }, [projections]);

  const netWorthData = useMemo(() => {
    if (projections.length === 0) return [];
    const years = new Set<number>();
    for (const p of projections) {
      for (const row of p.projection.yearRows) years.add(row.year);
    }
    const yearList = Array.from(years).sort((a, b) => a - b);
    return yearList.map((year) => {
      const row: Record<string, number | string | undefined> = { year };
      projections.forEach(({ scenarioId, projection }) => {
        const r = projection.yearRows.find((x) => x.year === year);
        row[escapeDataKey(scenarioId)] = r?.netWorth;
      });
      return row;
    });
  }, [projections]);

  const fiNumbers = useMemo(() => {
    return projections.map((p) => p.projection.fiNumber);
  }, [projections]);

  const firstFiNumber = fiNumbers[0] ?? 0;

  if (scenarios.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-surface-elevated">
        <p className="text-sm text-content-muted">
          Add at least 2 scenarios to compare projections.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-medium text-content">
          Compare scenarios
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Select up to 3 scenarios to compare Invested Assets and Net Worth
          over time.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {scenarios.map((scenario) => {
            const isSelected = selectedIds.includes(scenario.id);
            const color = isSelected
              ? COMPARE_COLORS[selectedIds.indexOf(scenario.id) % COMPARE_COLORS.length]
              : undefined;
            return (
              <label
                key={scenario.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 transition-colors hover:bg-surface"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleScenario(scenario.id)}
                  disabled={!isSelected && selectedIds.length >= MAX_SCENARIOS}
                  className="rounded border-border"
                />
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: isSelected ? color : "var(--content-muted)",
                  }}
                />
                <span className="text-sm font-medium text-content">
                  {scenario.name}
                </span>
              </label>
            );
          })}
          <button
            type="button"
            onClick={() => {
              if (projections.length === 0) return;
              downloadCompareJson(
                household,
                projections.map((p) => ({
                  scenarioId: p.scenarioId,
                  scenarioName: p.scenarioName,
                  scenario: scenarios.find((s) => s.id === p.scenarioId)!,
                  projection: p.projection,
                }))
              );
            }}
            disabled={projections.length === 0}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
            title={projections.length === 0 ? "Select scenarios to export" : "Download comparison data as JSON"}
          >
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
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {projections.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-surface-elevated">
          <p className="text-sm text-content-muted">
            Select 1–3 scenarios to compare.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface-elevated p-4">
            <h3 className="mb-4 text-sm font-semibold text-content">
              Invested Assets
            </h3>
            <div className="min-h-80 h-80 min-w-0 w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minHeight={320}
                minWidth={0}
                initialDimension={{ width: 600, height: 320 }}
              >
                <LineChart
                  data={investedData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "currentColor", opacity: 0.3 }}
                    className="text-content-muted"
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-content-muted"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                    }}
                    labelFormatter={(year) => `Year ${year}`}
                    formatter={(value: number | undefined, name?: string) => {
                      const key = name ?? "";
                      const p = projections.find((x) =>
                        escapeDataKey(x.scenarioId) === key
                      );
                      return [formatCurrency(value ?? 0), p?.scenarioName ?? key];
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={firstFiNumber}
                    stroke="var(--primary)"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{
                      value: `FI target (${formatCurrency(firstFiNumber)})`,
                      position: "right",
                      fontSize: 11,
                    }}
                  />
                  {projections.map(({ scenarioId, scenarioName }, i) => (
                    <Line
                      key={scenarioId}
                      type="monotone"
                      dataKey={escapeDataKey(scenarioId)}
                      name={scenarioName}
                      stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-elevated p-4">
            <h3 className="mb-4 text-sm font-semibold text-content">
              Net Worth
            </h3>
            <div className="min-h-80 h-80 min-w-0 w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minHeight={320}
                minWidth={0}
                initialDimension={{ width: 600, height: 320 }}
              >
                <LineChart
                  data={netWorthData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "currentColor", opacity: 0.3 }}
                    className="text-content-muted"
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-content-muted"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                    }}
                    labelFormatter={(year) => `Year ${year}`}
                    formatter={(value: number | undefined, name?: string) => {
                      const key = name ?? "";
                      const p = projections.find((x) =>
                        escapeDataKey(x.scenarioId) === key
                      );
                      return [formatCurrency(value ?? 0), p?.scenarioName ?? key];
                    }}
                  />
                  <Legend />
                  {projections.map(({ scenarioId, scenarioName }, i) => (
                    <Line
                      key={scenarioId}
                      type="monotone"
                      dataKey={escapeDataKey(scenarioId)}
                      name={scenarioName}
                      stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
