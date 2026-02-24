"use client";

import { useHouseholdStore } from "@/stores/household";
import { usePlanView } from "@/app/(app)/_components/PlanViewContext";
import { InvestedAssetsChart } from "@/components/charts/InvestedAssetsChart";

export function InvestedAssetsChartSection() {
  const projection = useHouseholdStore((s) => s.projection);
  const planProjection = useHouseholdStore((s) => s.planProjection);
  const usePlanViewMode = usePlanView();
  const projectionToUse = usePlanViewMode ? planProjection : projection;

  if (!projectionToUse) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-content">
        Invested assets & FI target
      </h2>
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        <InvestedAssetsChart projection={projectionToUse} />
      </div>
    </section>
  );
}
