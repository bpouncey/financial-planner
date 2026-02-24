"use client";

import { useHouseholdStore } from "@/stores/household";
import { ContributionVsGrowthChart } from "@/components/charts/ContributionVsGrowthChart";

export function ContributionVsGrowthChartSection() {
  const projection = useHouseholdStore((s) => s.projection);

  if (!projection) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-content">
        Contribution vs growth by year
      </h2>
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <ContributionVsGrowthChart projection={projection} />
      </div>
    </section>
  );
}
