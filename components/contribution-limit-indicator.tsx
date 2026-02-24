"use client";

import { getContributionLimitInfo } from "@/lib/model/contribution-limits";

interface ContributionLimitIndicatorProps {
  accountId: string;
  accountType: string;
  contributed: number;
  year: number;
  /** Employee vs employer breakdown for 401k/403b dual-limit display. */
  breakdown?: { employee: number; employer: number };
  /** For 401k/IRA: total in that bucket for this person (shared limit). */
  totalContributedInBucket?: number;
  /** For 401k: total employee deferral in 401k bucket. */
  totalEmployeeIn401kBucket?: number;
  /** Compact: show only bar + percentage. Full: show $X of $Y. */
  variant?: "compact" | "full";
  className?: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ContributionLimitIndicator({
  accountId,
  accountType,
  contributed,
  year,
  breakdown,
  totalContributedInBucket,
  totalEmployeeIn401kBucket,
  variant = "full",
  className = "",
}: ContributionLimitIndicatorProps) {
  const info = getContributionLimitInfo(
    accountId,
    accountType as
      | "TRADITIONAL_401K"
      | "ROTH_401K"
      | "TRADITIONAL_IRA"
      | "ROTH_IRA"
      | "403B"
      | "HSA",
    contributed,
    year,
    breakdown,
    totalContributedInBucket,
    totalEmployeeIn401kBucket
  );

  if (!info) return null;

  const has401kDualLimits =
    (accountType === "TRADITIONAL_401K" ||
      accountType === "ROTH_401K" ||
      accountType === "403B") &&
    info.employeeLimit != null &&
    info.combinedLimit != null &&
    info.employerContributed != null;

  if (has401kDualLimits && variant === "full") {
    const employeePct =
      (info.employeeLimit ?? 0) > 0
        ? ((info.employeeContributed ?? 0) / (info.employeeLimit ?? 1)) * 100
        : 0;
    const combinedPct =
      (info.combinedLimit ?? 0) > 0
        ? (contributed / (info.combinedLimit ?? 1)) * 100
        : 0;
    const hasEmployerContributions = (info.employerContributed ?? 0) > 0;
    const hasEmployeeContributions = (info.employeeContributed ?? 0) > 0;
    const showOnlyEmployee = !hasEmployerContributions && !hasEmployeeContributions;
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {!hasEmployerContributions && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-content-muted">Employee</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full transition-all ${
                  info.isOverEmployeeLimit
                    ? "bg-red-500"
                    : employeePct >= 100
                      ? "bg-green-500"
                      : "bg-accent"
                }`}
                style={{ width: `${Math.min(employeePct, 100)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-content-muted">
              {formatCurrency(info.employeeContributed ?? 0)} / {formatCurrency(info.employeeLimit ?? 0)}
            </span>
          </div>
        </div>
        )}
        {!showOnlyEmployee && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-content-muted">Combined (employee + employer)</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full transition-all ${
                  info.isOverCombinedLimit
                    ? "bg-red-500"
                    : combinedPct >= 100
                      ? "bg-green-500"
                      : "bg-accent"
                }`}
                style={{ width: `${Math.min(combinedPct, 100)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-content-muted">
              {formatCurrency(contributed)} / {formatCurrency(info.combinedLimit ?? 0)}
            </span>
          </div>
        </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      title={`${formatCurrency(info.contributed)} of ${formatCurrency(info.limit)} annual limit (${year})`}
    >
      <div className="flex items-center gap-2">
        <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-white">
          <div
            className={`h-full rounded-full transition-all ${
              info.isOverLimit
                ? "bg-red-500"
                : info.percentOfLimit >= 100
                  ? "bg-green-500"
                  : "bg-accent"
            }`}
            style={{
              width: `${Math.min(info.percentOfLimit, 100)}%`,
            }}
          />
        </div>
        <span
          className={`text-xs tabular-nums ${
            info.isOverLimit
              ? "text-red-600 dark:text-red-400"
              : "text-content-muted"
          }`}
        >
          {info.percentOfLimit >= 100 && !info.isOverLimit
            ? "Maxed"
            : `${Math.round(info.percentOfLimit)}%`}
        </span>
      </div>
      {variant === "full" && (
        <span className="text-xs text-content-muted">
          {formatCurrency(info.contributed)} of {formatCurrency(info.limit)}
          {info.isOverLimit && (
            <span className="ml-1 text-red-600 dark:text-red-400">
              (over limit)
            </span>
          )}
        </span>
      )}
    </div>
  );
}
