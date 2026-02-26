"use client";

import { useHouseholdStore } from "@/stores/household";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TrendingDown } from "lucide-react";

export function ShortfallBanner() {
  const planProjection = useHouseholdStore((s) => s.planProjection);

  if (!planProjection?.fiNotMetAtRetirementAge || !planProjection.shortfallData) {
    return null;
  }

  const { portfolioSupportsPerYear, targetSpendPerYear } =
    planProjection.shortfallData;

  return (
    <Alert
      className="mt-6 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200"
      role="alert"
    >
      <TrendingDown className="size-4" />
      <AlertTitle>Retirement shortfall at target age</AlertTitle>
      <AlertDescription>
        At retirement age, your portfolio supports $
        {Math.round(portfolioSupportsPerYear).toLocaleString()}/yr at your
        chosen SWR; your target spend is $
        {Math.round(targetSpendPerYear).toLocaleString()}/yr. Consider
        increasing savings, delaying retirement, or reducing retirement
        spending.
      </AlertDescription>
    </Alert>
  );
}
