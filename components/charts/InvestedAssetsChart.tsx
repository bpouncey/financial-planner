"use client";

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

interface InvestedAssetsChartProps {
  projection: ProjectionResult;
}

export function InvestedAssetsChart({ projection }: InvestedAssetsChartProps) {
  const { yearRows, fiNumber } = projection;
  const data = yearRows.map((row) => ({
    year: row.year,
    investedAssets: row.investedAssets,
  }));

  return (
    <div className="min-h-80 h-80 min-w-0 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={320}
        minWidth={0}
        initialDimension={{ width: 600, height: 320 }}
      >
        <LineChart
          data={data}
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
            formatter={(value: number | undefined) => [
              formatCurrency(value ?? 0),
              "Invested assets",
            ]}
          />
          <Legend
            formatter={() => "Invested assets"}
            wrapperStyle={{ fontSize: 12 }}
          />
          <ReferenceLine
            y={fiNumber}
            stroke="var(--primary)"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: `FI target (${formatCurrency(fiNumber)})`,
              position: "right",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="investedAssets"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
