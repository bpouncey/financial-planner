"use client";

import { getContributionLimitInfo } from "@/lib/model/contribution-limits";

interface ContributionLimitIndicatorProps {
  accountId: string;
  accountType: string;
  contributed: number;
  year: number;
  /** Employee vs employer breakdown for 401k/403b (employee limit is shared per person). */
  breakdown?: { employee: number; employer: number };
  /** For 401k/IRA/HSA: total in that bucket for this person (shared limit). */
  totalContributedInBucket?: number;
  /** For 401k/403b: total employee deferral in 401k bucket (Trad+Roth share limit). */
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

  const displayAmount = info.displayContributed ?? info.contributed;

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      title={`${formatCurrency(displayAmount)} of ${formatCurrency(info.limit)} annual limit (${year})`}
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
          {formatCurrency(displayAmount)} of {formatCurrency(info.limit)}
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
