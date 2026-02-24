"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHouseholdStore } from "@/stores/household";
import { usePlanView } from "@/app/(app)/_components/PlanViewContext";
import type { AccountType } from "@/lib/types/zod";

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "CASH",
  "TAXABLE",
  "MONEY_MARKET",
  "TRADITIONAL_401K",
  "ROTH_401K",
  "TRADITIONAL_IRA",
  "ROTH_IRA",
  "403B",
  "HSA",
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Cash",
  TAXABLE: "Taxable",
  MONEY_MARKET: "Money Market",
  TRADITIONAL_401K: "Traditional 401k",
  ROTH_401K: "Roth 401k",
  TRADITIONAL_IRA: "Traditional IRA",
  ROTH_IRA: "Roth IRA",
  "403B": "403(b)",
  HSA: "HSA",
};

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  CASH: "#a1a1aa",
  TAXABLE: "#3b82f6",
  MONEY_MARKET: "#6366f1",
  TRADITIONAL_401K: "#f59e0b",
  ROTH_401K: "#84cc16",
  TRADITIONAL_IRA: "#ea580c",
  ROTH_IRA: "#22c55e",
  "403B": "#c2410c",
  HSA: "#14b8a6",
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

type TimeRange = "all" | "30y" | "20y" | "10y";

export function NetWorthChart() {
  const gradientIdPrefix = React.useId().replace(/:/g, "");
  const { household, projection, planProjection } = useHouseholdStore();
  const usePlanViewMode = usePlanView();
  const projectionToUse = usePlanViewMode ? planProjection : projection;
  const [timeRange, setTimeRange] = React.useState<TimeRange>("all");

  if (!projectionToUse || !projectionToUse.yearRows.length) {
    return (
      <Card className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No projection data. Complete household setup to see net worth.
        </p>
      </Card>
    );
  }

  const accountById = new Map(household.accounts.map((a) => [a.id, a]));
  const typeOrder = ACCOUNT_TYPE_ORDER.filter((t) =>
    household.accounts.some((a) => a.type === t)
  );

  const chartData = projectionToUse.yearRows.map((row) => {
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

  const filteredData = React.useMemo(() => {
    if (timeRange === "all") return chartData;
    const years = timeRange === "30y" ? 30 : timeRange === "20y" ? 20 : 10;
    const maxYear = Math.max(...chartData.map((d) => d.year));
    const minYear = maxYear - years;
    return chartData.filter((d) => d.year >= minYear);
  }, [chartData, timeRange]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      netWorth: { label: "Net Worth" },
    };
    for (const type of typeOrder) {
      config[type] = {
        label: ACCOUNT_TYPE_LABELS[type],
        color: ACCOUNT_TYPE_COLORS[type],
      };
    }
    return config;
  }, [typeOrder]);

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Net Worth Over Time</CardTitle>
          <CardDescription>
            Projected net worth by account type
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select time range"
          >
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg">
              All years
            </SelectItem>
            <SelectItem value="30y" className="rounded-lg">
              Last 30 years
            </SelectItem>
            <SelectItem value="20y" className="rounded-lg">
              Last 20 years
            </SelectItem>
            <SelectItem value="10y" className="rounded-lg">
              Last 10 years
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[320px] w-full min-h-[320px]"
        >
          <AreaChart
            accessibilityLayer
            data={filteredData}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={70}
              tickFormatter={(v) => formatCurrency(Number(v))}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `Year ${value}`}
                  formatter={(value) =>
                    value != null ? formatCurrency(Number(value)) : ""
                  }
                  indicator="dot"
                />
              }
            />
            <defs>
              {typeOrder.map((type) => (
                <linearGradient
                  key={type}
                  id={`${gradientIdPrefix}-fill-${type}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${type})`}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${type})`}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            {typeOrder.map((type) => (
              <Area
                key={type}
                dataKey={type}
                type="natural"
                fill={`url(#${gradientIdPrefix}-fill-${type})`}
                fillOpacity={0.4}
                stroke={`var(--color-${type})`}
                stackId="a"
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
