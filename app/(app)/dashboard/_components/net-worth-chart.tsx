"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHouseholdStore } from "@/stores/household";
import type { AccountType } from "@/lib/types/zod";

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "CASH",
  "TAXABLE",
  "MONEY_MARKET",
  "TRADITIONAL",
  "403B",
  "ROTH",
  "HSA",
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Cash",
  TAXABLE: "Taxable",
  MONEY_MARKET: "Money Market",
  TRADITIONAL: "Traditional",
  "403B": "403(b)",
  ROTH: "Roth",
  HSA: "HSA",
};

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  CASH: "#a1a1aa", // zinc-400
  TAXABLE: "#3b82f6", // blue-500
  MONEY_MARKET: "#6366f1", // indigo-500
  TRADITIONAL: "#f59e0b", // amber-500
  "403B": "#ea580c", // orange-600
  ROTH: "#22c55e", // green-500
  HSA: "#14b8a6", // teal-500
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetWorthChart() {
  const { household, projection } = useHouseholdStore();

  if (!projection || !projection.yearRows.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface-elevated">
        <p className="text-sm text-content-muted">
          No projection data. Complete household setup to see net worth.
        </p>
      </div>
    );
  }

  // Aggregate ending balances by account type
  const accountById = new Map(household.accounts.map((a) => [a.id, a]));
  const typeOrder = ACCOUNT_TYPE_ORDER.filter((t) =>
    household.accounts.some((a) => a.type === t)
  );

  const chartData = projection.yearRows.map((row) => {
    const byType: Record<string, number> = {};
    for (const type of typeOrder) {
      byType[type] = 0;
    }
    for (const [accountId, balance] of Object.entries(row.endingBalances)) {
      const account = accountById.get(accountId);
      if (account && byType[account.type] !== undefined) {
        byType[account.type] += balance;
      }
    }
    return {
      year: row.year,
      ...byType,
      netWorth: row.netWorth,
    };
  });

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="mb-4 text-sm font-semibold text-content">
        Net Worth Over Time
      </h2>
      <div className="h-80 min-h-80 min-w-0 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minHeight={320}
          minWidth={0}
          initialDimension={{ width: 600, height: 320 }}
        >
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              {typeOrder.map((type) => (
                <linearGradient
                  key={type}
                  id={`gradient-${type}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={ACCOUNT_TYPE_COLORS[type]}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor={ACCOUNT_TYPE_COLORS[type]}
                    stopOpacity={0.2}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
            />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              formatter={(value: number | undefined) =>
                value != null ? formatCurrency(value) : ""
              }
              labelFormatter={(year) => `Year ${year}`}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-elevated)",
              }}
            />
            <Legend />
            {typeOrder.map((type) => (
              <Area
                key={type}
                type="monotone"
                dataKey={type}
                name={ACCOUNT_TYPE_LABELS[type]}
                stackId="1"
                stroke={ACCOUNT_TYPE_COLORS[type]}
                fill={`url(#gradient-${type})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
