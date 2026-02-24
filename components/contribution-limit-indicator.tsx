"use client";

import { getContributionLimitInfo } from "@/lib/model/contribution-limits";

interface ContributionLimitIndicatorProps {
  accountId: string;
  accountType: string;
  contributed: number;
  year: number;
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
  variant = "full",
  className = "",
}: ContributionLimitIndicatorProps) {
  const info = getContributionLimitInfo(
    accountId,
    accountType as "TRADITIONAL" | "403B" | "ROTH" | "HSA",
    contributed,
    year
  );

  if (!info) return null;

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      title={`${formatCurrency(info.contributed)} of ${formatCurrency(info.limit)} annual limit (${year})`}
    >
      <div className="flex items-center gap-2">
        <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-surface-elevated">
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
