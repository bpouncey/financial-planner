"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ProjectionResult } from "@/lib/model/engine";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

const DATA_TYPES = [
  { key: "contribution" as const, label: "Contributions", color: "var(--primary)" },
  { key: "growth" as const, label: "Growth", color: "var(--info)" },
  { key: "netWorth" as const, label: "Net worth", color: "oklch(0.65 0.18 75)" },
] as const;

interface ContributionVsGrowthChartProps {
  projection: ProjectionResult;
}

export function ContributionVsGrowthChart({
  projection,
}: ContributionVsGrowthChartProps) {
  const [visibility, setVisibility] = useState({
    contribution: true,
    growth: true,
    netWorth: true,
  });

  const toggle = (key: keyof typeof visibility) =>
    setVisibility((v) => ({ ...v, [key]: !v[key] }));

  const { yearRows } = projection;
  const data = yearRows.map((row) => ({
    year: row.year,
    contribution: Object.values(row.contributionsByAccount ?? {}).reduce(
      (a, b) => a + b,
      0
    ),
    growth: Object.values(row.growthByAccount ?? {}).reduce((a, b) => a + b, 0),
    netWorth: row.netWorth,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-content-muted">Show:</span>
        {DATA_TYPES.map(({ key, label, color }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <input
              type="checkbox"
              checked={visibility[key]}
              onChange={() => toggle(key)}
              className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
            />
            <span className="text-content">{label}</span>
          </label>
        ))}
      </div>
      <div className="min-h-80 h-80 min-w-0 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minHeight={320}
          minWidth={0}
          initialDimension={{ width: 600, height: 320 }}
        >
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          barGap={0}
          barCategoryGap="10%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border"
            vertical={false}
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
            formatter={(value: number | undefined, name?: string) => [
              formatCurrency(value ?? 0),
              name === "contribution"
                ? "Contributions"
                : name === "growth"
                  ? "Growth"
                  : "Net worth",
            ]}
            cursor={{ fill: "var(--border)", opacity: 0.3 }}
          />
          <Legend
            formatter={(value) =>
              value === "contribution"
                ? "Contributions"
                : value === "growth"
                  ? "Growth"
                  : "Net worth"
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          {visibility.contribution && (
            <Bar
              dataKey="contribution"
              name="contribution"
              stackId="a"
              fill="var(--primary)"
              radius={[0, 0, 4, 4]}
            />
          )}
          {visibility.growth && (
            <Bar
              dataKey="growth"
              name="growth"
              stackId="a"
              fill="var(--info)"
              radius={[4, 4, 0, 0]}
            />
          )}
          {visibility.netWorth && (
            <Bar
              dataKey="netWorth"
              name="netWorth"
              fill="oklch(90.5% 0.182 98.111)"
              radius={[4, 4, 4, 4]}
            />
          )}
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
