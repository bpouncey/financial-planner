import Link from "next/link";
import { PrimaryMetricsPanel } from "../dashboard/_components/PrimaryMetricsPanel";
import { FooStepGuide } from "../dashboard/_components/FooStepGuide";
import { RoadmapTimeline } from "../dashboard/_components/RoadmapTimeline";
import { AssumptionsPanel } from "../dashboard/_components/AssumptionsPanel";
import { NetWorthChart } from "../dashboard/_components/net-worth-chart";
import { InvestedAssetsChartSection } from "../dashboard/_components/InvestedAssetsChartSection";
import { ContributionVsGrowthChartSection } from "../dashboard/_components/ContributionVsGrowthChartSection";
import { YearByYearTable } from "../dashboard/_components/YearByYearTable";
import { ExportProjectionButton } from "../dashboard/_components/ExportProjectionButton";
import { ValidationBanner } from "@/app/(app)/setup/_components/validation-banner";
import { WhatChangedPanel } from "../dashboard/_components/WhatChangedPanel";
import { PlanViewProvider } from "../_components/PlanViewContext";

export default function PlanPage() {
  return (
    <PlanViewProvider>
      <div className="p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Plan
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Your current state, FOO tracker, plan projection metrics, and
              roadmap.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/explore"
              className="text-sm font-medium text-content-muted hover:text-content"
            >
              Explore scenarios →
            </Link>
            <ExportProjectionButton />
          </div>
        </div>
        <ValidationBanner />
        <WhatChangedPanel />
        <div className="mt-8 space-y-8">
          <AssumptionsPanel />
          <FooStepGuide />
          <PrimaryMetricsPanel />
          <RoadmapTimeline />
          <NetWorthChart />
          <InvestedAssetsChartSection />
          <ContributionVsGrowthChartSection />
          <YearByYearTable />
        </div>
      </div>
    </PlanViewProvider>
  );
}
