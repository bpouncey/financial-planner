"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useHouseholdStore } from "@/stores/household";
import type { YearRow } from "@/lib/model/engine";
import type { Account } from "@/lib/types/zod";
import { formatCurrency } from "@/lib/utils/format";
import { getWhyZeroContribution } from "@/lib/utils/why-zero";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { HELP_TABLE, HELP_METRICS, formatHelpContent } from "@/lib/copy/help";

type AccountColumnVisibility = {
  contrib: boolean;
  withdrawal: boolean;
  growth: boolean;
  end: boolean;
};

type ColumnVisibility = {
  income: boolean;
  taxes: boolean;
  withdrawalTaxes: boolean;
  spending: boolean;
  netWorth: boolean;
  invested: boolean;
  accountColumns: Record<string, AccountColumnVisibility>;
};

const DEFAULT_ACCOUNT_COLS: AccountColumnVisibility = {
  contrib: true,
  withdrawal: true,
  growth: true,
  end: true,
};

const cellBase =
  "px-4 py-2 text-right text-sm tabular-nums text-content border-b border-border";
const headerBase =
  "px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted border-b border-border bg-surface-elevated sticky top-0 z-[50] min-h-[2.75rem]";
const accountHeaderBase =
  "px-3 py-2 text-right text-xs font-medium text-content-muted border-b border-border sticky z-[50] min-h-[2.5rem] align-bottom [top:calc(var(--header-row-1-height,2.75rem)-1px)]";
const yearCellBase =
  "px-4 py-2 text-sm font-medium text-content border-b border-border sticky left-0 bg-surface z-10";
const yearHeaderBase =
  "px-4 py-3 text-xs font-medium uppercase tracking-wider text-content-muted border-b border-border bg-surface-elevated sticky left-0 top-0 z-[60] min-h-[2.75rem]";

/** Type labels and background colors for account column groups */
const ACCOUNT_TYPE_META = {
  contrib: {
    label: "Contributions",
    bgVar: "var(--type-contrib-bg)",
    helpKey: "contrib" as const,
  },
  withdrawal: {
    label: "Withdraw",
    bgVar: "var(--type-withdrawal-bg)",
    helpKey: "withdrawal" as const,
  },
  growth: {
    label: "Growth",
    bgVar: "var(--type-growth-bg)",
    helpKey: "growth" as const,
  },
  end: {
    label: "End",
    bgVar: "var(--type-end-bg)",
    helpKey: "endBalance" as const,
  },
} as const;

function formatCell(value: number): string {
  return formatCurrency(value);
}

function formatAgeCell(year: number, people: { birthYear?: number }[]): string {
  const ages = people
    .filter((p) => p.birthYear != null)
    .map((p) => year - (p.birthYear ?? 0));
  return ages.length === 0 ? "—" : ages.join(" / ");
}

function getAccountColVisibility(
  col: ColumnVisibility,
  accountId: string,
  key: keyof AccountColumnVisibility
): boolean {
  const acc = col.accountColumns[accountId];
  return acc?.[key] ?? DEFAULT_ACCOUNT_COLS[key];
}

type ViewMode = "overview" | "full";

export function YearByYearTable() {
  const { projection, household } = useHouseholdStore();
  const [hideZeroColumns, setHideZeroColumns] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [colVisibility, setColVisibility] = useState<ColumnVisibility>({
    income: true,
    taxes: true,
    withdrawalTaxes: true,
    spending: true,
    netWorth: true,
    invested: true,
    accountColumns: {},
  });

  const setCol = useCallback(
    <K extends keyof Omit<ColumnVisibility, "accountColumns">>(
      key: K,
      value: ColumnVisibility[K]
    ) => {
      setColVisibility((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setAccountCol = useCallback(
    (accountId: string, key: keyof AccountColumnVisibility, value: boolean) => {
      setColVisibility((prev) => ({
        ...prev,
        accountColumns: {
          ...prev.accountColumns,
          [accountId]: {
            ...DEFAULT_ACCOUNT_COLS,
            ...prev.accountColumns[accountId],
            [key]: value,
          },
        },
      }));
    },
    []
  );

  const accounts: Account[] = household.accounts;
  const people = household.people;
  const allYearRows = useMemo<YearRow[]>(
    () => projection?.yearRows ?? [],
    [projection?.yearRows]
  );
  const fiYear = projection?.fiYear ?? null;
  const coastFiYear = projection?.coastFiYear ?? null;
  const emergencyFundGoal = household.emergencyFundGoal;
  const emergencyFundFundedYear =
    emergencyFundGoal?.targetAmount &&
    emergencyFundGoal?.accountId &&
    (projection?.yearRows.find(
      (r) =>
        (r.endingBalances[emergencyFundGoal.accountId!] ?? 0) >=
        emergencyFundGoal.targetAmount
    )?.year ?? null);

  const { defaultStart, defaultEnd } = useMemo(() => {
    if (allYearRows.length === 0) {
      const y = new Date().getFullYear();
      return { defaultStart: y, defaultEnd: y + 14 };
    }
    const firstYear = allYearRows[0]!.year;
    const lastYear = allYearRows[allYearRows.length - 1]!.year;
    return {
      defaultStart: firstYear,
      defaultEnd: lastYear,
    };
  }, [allYearRows]);

  const [startYear, setStartYear] = useState(defaultStart);
  const [endYear, setEndYear] = useState(defaultEnd);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRow1Ref = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setStartYear(defaultStart);
      setEndYear(defaultEnd);
    });
  }, [defaultStart, defaultEnd]);

  const yearRows = useMemo(() => {
    return allYearRows.filter((r) => r.year >= startYear && r.year <= endYear);
  }, [allYearRows, startYear, endYear]);

  const visibleAccounts = useMemo(() => {
    if (!hideZeroColumns) return accounts;
    const withContributions = new Set<string>();
    for (const row of yearRows) {
      for (const [accountId, amt] of Object.entries(row.contributionsByAccount ?? {})) {
        if (amt > 0) withContributions.add(accountId);
      }
    }
    return accounts.filter((a) => withContributions.has(a.id));
  }, [hideZeroColumns, accounts, yearRows]);

  const hasTwoRowHeader =
    viewMode === "full" &&
    (visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "contrib")) ||
      visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "withdrawal")) ||
      visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "growth")) ||
      visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "end")));

  useEffect(() => {
    if (!hasTwoRowHeader || !scrollContainerRef.current || !headerRow1Ref.current) return;
    const container = scrollContainerRef.current;
    const row = headerRow1Ref.current;
    const setHeight = () => {
      const h = row.offsetHeight;
      if (h > 0) container.style.setProperty("--header-row-1-height", `${h}px`);
    };
    let ro: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      setHeight();
      ro = new ResizeObserver(setHeight);
      ro.observe(row);
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [hasTwoRowHeader]);

  if (!projection?.yearRows?.length) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-8 text-center">
        <p className="text-sm text-content-muted">
          No projection data. Complete setup and add accounts to see the
          year-by-year table.
        </p>
      </div>
    );
  }

  const hasWithdrawalPhase = yearRows.some(
    (r) => r.phase === "withdrawal" || (r.withdrawalByAccount && Object.values(r.withdrawalByAccount).some((v) => v > 0))
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-content">
          Year-by-year table
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-content-muted">Years</span>
            <input
              type="number"
              value={startYear}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setStartYear(Math.max(allYearRows[0]?.year ?? n, Math.min(n, endYear)));
              }}
              min={allYearRows[0]?.year}
              max={allYearRows[allYearRows.length - 1]?.year}
              className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-content focus:ring-accent"
              aria-label="Start year"
            />
            <span className="text-content-muted">–</span>
            <input
              type="number"
              value={endYear}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setEndYear(Math.min(allYearRows[allYearRows.length - 1]?.year ?? n, Math.max(n, startYear)));
              }}
              min={allYearRows[0]?.year}
              max={allYearRows[allYearRows.length - 1]?.year}
              className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-content focus:ring-accent"
              aria-label="End year"
            />
          </div>
          <div className="flex rounded-md border border-border bg-surface-elevated p-0.5" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "overview"
                  ? "bg-accent text-accent-foreground"
                  : "text-content-muted hover:text-content"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setViewMode("full")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "full"
                  ? "bg-accent text-accent-foreground"
                  : "text-content-muted hover:text-content"
              }`}
            >
              Full
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideZeroColumns}
              onChange={(e) => setHideZeroColumns(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
            />
            <span className="text-sm text-content">
              Hide zero-contribution columns
            </span>
          </label>
          <details className="relative group">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-content hover:bg-surface [&::-webkit-details-marker]:hidden">
              Columns
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border border-border bg-surface-elevated p-3 shadow-lg">
              <div className="space-y-3 text-sm">
                <div className="font-medium text-content-muted">Show columns</div>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={colVisibility.income}
                      onChange={(e) => setCol("income", e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
                    />
                    <span className="text-content">Income</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={colVisibility.taxes}
                      onChange={(e) => setCol("taxes", e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
                    />
                    <span className="text-content">Taxes</span>
                  </label>
                  {hasWithdrawalPhase && (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={colVisibility.withdrawalTaxes}
                        onChange={(e) => setCol("withdrawalTaxes", e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
                      />
                      <span className="text-content">Withdrawal taxes</span>
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={colVisibility.spending}
                      onChange={(e) => setCol("spending", e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
                    />
                    <span className="text-content">Spending</span>
                  </label>
                </div>
                {visibleAccounts.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-2">
                    <div className="font-medium text-content-muted">Account columns</div>
                    {visibleAccounts.map((a) => (
                      <div key={a.id} className="ml-2 space-y-1.5">
                        <div className="text-content-muted">{a.name}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--type-contrib-bg)" }} aria-hidden />
                            <input
                              type="checkbox"
                              checked={getAccountColVisibility(colVisibility, a.id, "contrib")}
                              onChange={(e) => setAccountCol(a.id, "contrib", e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-border bg-surface text-content focus:ring-accent"
                            />
                            <span className="text-content">Contributions</span>
                          </label>
                          {hasWithdrawalPhase && (
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--type-withdrawal-bg)" }} aria-hidden />
                              <input
                                type="checkbox"
                                checked={getAccountColVisibility(colVisibility, a.id, "withdrawal")}
                                onChange={(e) => setAccountCol(a.id, "withdrawal", e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-border bg-surface text-content focus:ring-accent"
                              />
                              <span className="text-content">Withdraw</span>
                            </label>
                          )}
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--type-growth-bg)" }} aria-hidden />
                            <input
                              type="checkbox"
                              checked={getAccountColVisibility(colVisibility, a.id, "growth")}
                              onChange={(e) => setAccountCol(a.id, "growth", e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-border bg-surface text-content focus:ring-accent"
                            />
                            <span className="text-content">Growth</span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--type-end-bg)" }} aria-hidden />
                            <input
                              type="checkbox"
                              checked={getAccountColVisibility(colVisibility, a.id, "end")}
                              onChange={(e) => setAccountCol(a.id, "end", e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-border bg-surface text-content focus:ring-accent"
                            />
                            <span className="text-content">End</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 border-t border-border pt-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={colVisibility.netWorth}
                      onChange={(e) => setCol("netWorth", e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
                    />
                    <span className="text-content">Net worth</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={colVisibility.invested}
                      onChange={(e) => setCol("invested", e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
                    />
                    <span className="text-content">Invested</span>
                  </label>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
      <div ref={scrollContainerRef} className="overflow-auto max-h-[70vh] rounded-lg border border-border isolate">
        <table className="min-w-full">
          <thead className="bg-surface-elevated">
            {viewMode === "full" &&
            (visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "contrib")) ||
              visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "withdrawal")) ||
              visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "growth")) ||
              visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, "end"))) ? (
              <>
                <tr ref={headerRow1Ref}>
                  <th rowSpan={2} className={yearHeaderBase}>
                    Year
                  </th>
                  <th rowSpan={2} className={headerBase}>Age</th>
                  {colVisibility.income && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Income
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.income)} side="top" />
                      </span>
                    </th>
                  )}
                  {colVisibility.taxes && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Taxes
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.taxes)} side="top" />
                      </span>
                    </th>
                  )}
                  {hasWithdrawalPhase && colVisibility.withdrawalTaxes && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Withdrawal taxes
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.withdrawalPhaseTaxes)} side="top" />
                      </span>
                    </th>
                  )}
                  {colVisibility.spending && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Spending
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.spending)} side="top" />
                      </span>
                    </th>
                  )}
                  {hasWithdrawalPhase && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Funding gap
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.fundingGap)} side="top" />
                      </span>
                    </th>
                  )}
                  {(["contrib", "withdrawal", "growth", "end"] as const).map((typeKey) => {
                    const meta = ACCOUNT_TYPE_META[typeKey];
                    const visible =
                      typeKey === "withdrawal"
                        ? hasWithdrawalPhase &&
                          visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, typeKey))
                        : visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, typeKey));
                    if (!visible) return null;
                    const count = visibleAccounts.filter((a) =>
                      typeKey === "withdrawal" ? hasWithdrawalPhase && getAccountColVisibility(colVisibility, a.id, typeKey) : getAccountColVisibility(colVisibility, a.id, typeKey)
                    ).length;
                    return (
                      <th
                        key={typeKey}
                        colSpan={count}
                        className={`${headerBase} text-center`}
                        style={{ backgroundColor: meta.bgVar }}
                      >
                        <span className="flex items-center justify-center gap-1">
                          {meta.label}
                          <HelpTooltip
                            content={formatHelpContent(HELP_TABLE[meta.helpKey])}
                            side="top"
                          />
                        </span>
                      </th>
                    );
                  })}
                  {colVisibility.netWorth && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Net worth
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.netWorth)} side="top" />
                      </span>
                    </th>
                  )}
                  {colVisibility.invested && (
                    <th rowSpan={2} className={headerBase}>
                      <span className="flex items-center justify-end gap-1">
                        Invested
                        <HelpTooltip content={formatHelpContent(HELP_TABLE.invested)} side="top" />
                      </span>
                    </th>
                  )}
                </tr>
                <tr>
                  {(["contrib", "withdrawal", "growth", "end"] as const).map((typeKey) => {
                    const meta = ACCOUNT_TYPE_META[typeKey];
                    const visible =
                      typeKey === "withdrawal"
                        ? hasWithdrawalPhase &&
                          visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, typeKey))
                        : visibleAccounts.some((a) => getAccountColVisibility(colVisibility, a.id, typeKey));
                    if (!visible) return null;
                    return visibleAccounts
                      .filter((a) =>
                        typeKey === "withdrawal"
                          ? hasWithdrawalPhase && getAccountColVisibility(colVisibility, a.id, typeKey)
                          : getAccountColVisibility(colVisibility, a.id, typeKey)
                      )
                      .map((a) => (
                        <th
                          key={`${typeKey}-${a.id}`}
                          className={accountHeaderBase}
                          style={{ backgroundColor: meta.bgVar }}
                        >
                          {a.name}
                        </th>
                      ));
                  })}
                </tr>
              </>
            ) : (
              <tr>
                <th className={yearHeaderBase}>Year</th>
                <th className={headerBase}>Age</th>
                {(viewMode === "overview" || colVisibility.income) && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Income
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.income)} side="top" />
                    </span>
                  </th>
                )}
                {viewMode === "full" && colVisibility.taxes && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Taxes
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.taxes)} side="top" />
                    </span>
                  </th>
                )}
                {viewMode === "full" && hasWithdrawalPhase && colVisibility.withdrawalTaxes && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Withdrawal taxes
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.withdrawalPhaseTaxes)} side="top" />
                    </span>
                  </th>
                )}
                {(viewMode === "overview" || colVisibility.spending) && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Spending
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.spending)} side="top" />
                    </span>
                  </th>
                )}
                {hasWithdrawalPhase && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Funding gap
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.fundingGap)} side="top" />
                    </span>
                  </th>
                )}
                {(viewMode === "overview" || colVisibility.netWorth) && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Net worth
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.netWorth)} side="top" />
                    </span>
                  </th>
                )}
                {(viewMode === "overview" || colVisibility.invested) && (
                  <th className={headerBase}>
                    <span className="flex items-center justify-end gap-1">
                      Invested
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.invested)} side="top" />
                    </span>
                  </th>
                )}
                {viewMode === "overview" && <th className={headerBase}>Phase</th>}
              </tr>
            )}
          </thead>
          <tbody>
            {yearRows.map((row) => {
              const isFiYear = fiYear != null && row.year === fiYear;
              const isCoastFiYear = coastFiYear != null && row.year === coastFiYear;
              const isEmergencyFundYear =
                emergencyFundFundedYear != null &&
                row.year === emergencyFundFundedYear;
              const yearCellClasses = [
                yearCellBase,
                isFiYear && "border-l-2 border-l-success",
                isCoastFiYear && !isFiYear && "border-l-2 border-l-info",
                isEmergencyFundYear &&
                  !isFiYear &&
                  !isCoastFiYear &&
                  "border-l-2 border-l-amber-500",
              ]
                .filter(Boolean)
                .join(" ");
              return (
              <tr key={row.year} className="hover:bg-surface-elevated">
                <td className={yearCellClasses}>
                  <span className="flex items-center gap-2">
                    <span>{row.year}</span>
                    {viewMode === "full" && (
                      row.phase === "withdrawal" ? (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-info text-info-foreground">
                          Withdrawal
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border border-border bg-surface-elevated text-content-muted">
                          Accumulation
                        </span>
                      )
                    )}
                    {isFiYear && (
                      <HelpTooltip
                        content={formatHelpContent(HELP_METRICS.fiYear)}
                        side="top"
                      >
                        <span className="inline-flex items-center rounded bg-success px-1.5 py-0.5 text-xs font-medium text-success-foreground">
                          FI
                        </span>
                      </HelpTooltip>
                    )}
                    {isCoastFiYear && (
                      <HelpTooltip
                        content={formatHelpContent(HELP_METRICS.coastFiYear)}
                        side="top"
                      >
                        <span className="inline-flex items-center rounded bg-info px-1.5 py-0.5 text-xs font-medium text-info-foreground">
                          Coast FI
                        </span>
                      </HelpTooltip>
                    )}
                    {isEmergencyFundYear && (
                      <HelpTooltip
                        content={formatHelpContent(
                          HELP_METRICS.emergencyFundFundedYear
                        )}
                        side="top"
                      >
                        <span className="inline-flex items-center rounded bg-amber-500 px-1.5 py-0.5 text-xs font-medium text-white">
                          Emergency fund
                        </span>
                      </HelpTooltip>
                    )}
                  </span>
                </td>
                <td className={cellBase}>
                  {formatAgeCell(row.year, people)}
                </td>
                {(viewMode === "overview" || colVisibility.income) && (
                  <td className={cellBase}>{formatCell(row.grossIncome)}</td>
                )}
                {viewMode === "full" && colVisibility.taxes && (
                  <td className={cellBase}>
                    {formatCell(
                      row.phase === "withdrawal" ? 0 : row.taxes
                    )}
                  </td>
                )}
                {viewMode === "full" && hasWithdrawalPhase && colVisibility.withdrawalTaxes && (
                  <td className={cellBase}>
                    {formatCell(row.withdrawalPhaseTaxes ?? 0)}
                  </td>
                )}
                {(viewMode === "overview" || colVisibility.spending) && (
                  <td className={cellBase}>{formatCell(row.spending)}</td>
                )}
                {hasWithdrawalPhase && (
                  <td className={cellBase}>
                    {(row.withdrawalShortfall ?? 0) > 0 ? (
                      <HelpTooltip content={formatHelpContent(HELP_TABLE.fundingGap)} side="top">
                        <span className="inline-flex items-center gap-1.5 text-amber-700 cursor-help border-b border-dotted border-amber-500/50 dark:text-amber-300 dark:border-amber-400/50">
                          <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {formatCell(row.withdrawalShortfall ?? 0)}
                        </span>
                      </HelpTooltip>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {viewMode === "full" && visibleAccounts.map((a) => {
                  if (!getAccountColVisibility(colVisibility, a.id, "contrib"))
                    return null;
                  const contrib = row.contributionsByAccount[a.id] ?? 0;
                  const whyZero =
                    contrib === 0
                      ? getWhyZeroContribution(
                          household,
                          a.id,
                          row.year,
                          row.phase ?? "accumulation"
                        )
                      : null;
                  return (
                    <td
                      key={`contrib-${a.id}-${row.year}`}
                      className={cellBase}
                      style={{ backgroundColor: "var(--type-contrib-cell)" }}
                    >
                      {whyZero ? (
                        <HelpTooltip content={whyZero} side="top">
                          <span
                            className="cursor-help border-b border-dotted border-content-muted"
                            tabIndex={0}
                          >
                            {formatCell(contrib)}
                          </span>
                        </HelpTooltip>
                      ) : (
                        formatCell(contrib)
                      )}
                    </td>
                  );
                })}
                {viewMode === "full" && hasWithdrawalPhase &&
                  visibleAccounts.map((a) =>
                    getAccountColVisibility(colVisibility, a.id, "withdrawal") ? (
                      <td
                        key={`withdrawal-${a.id}-${row.year}`}
                        className={cellBase}
                        style={{ backgroundColor: "var(--type-withdrawal-cell)" }}
                      >
                        {formatCell(row.withdrawalByAccount?.[a.id] ?? 0)}
                      </td>
                    ) : null
                  )}
                {viewMode === "full" && visibleAccounts.map((a) =>
                  getAccountColVisibility(colVisibility, a.id, "growth") ? (
                    <td key={`growth-${a.id}-${row.year}`} className={cellBase} style={{ backgroundColor: "var(--type-growth-cell)" }}>
                      {formatCell(row.growthByAccount[a.id] ?? 0)}
                    </td>
                  ) : null
                )}
                {viewMode === "full" && visibleAccounts.map((a) =>
                  getAccountColVisibility(colVisibility, a.id, "end") ? (
                    <td key={`end-${a.id}-${row.year}`} className={cellBase} style={{ backgroundColor: "var(--type-end-cell)" }}>
                      {formatCell(row.endingBalances[a.id] ?? 0)}
                    </td>
                  ) : null
                )}
                {(viewMode === "overview" || colVisibility.netWorth) && (
                  <td className={`${cellBase} font-medium`}>
                    {formatCell(row.netWorth)}
                  </td>
                )}
                {(viewMode === "overview" || colVisibility.invested) && (
                  <td className={cellBase}>{formatCell(row.investedAssets)}</td>
                )}
                {viewMode === "overview" && (
                  <td className={cellBase}>
                    <span className={
                      row.phase === "withdrawal"
                        ? "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-info text-info-foreground"
                        : "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border border-border bg-surface-elevated text-content-muted"
                    }>
                      {row.phase === "withdrawal" ? "Withdrawal" : "Accumulation"}
                    </span>
                  </td>
                )}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
