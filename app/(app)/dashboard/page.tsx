import Link from "next/link";
import { PrimaryMetricsPanel } from "./_components/PrimaryMetricsPanel";
import { FooStepGuide } from "./_components/FooStepGuide";
import { RoadmapTimeline } from "./_components/RoadmapTimeline";
import { AssumptionsPanel } from "./_components/AssumptionsPanel";
import { NetWorthChart } from "./_components/net-worth-chart";
import { InvestedAssetsChartSection } from "./_components/InvestedAssetsChartSection";
import { ContributionVsGrowthChartSection } from "./_components/ContributionVsGrowthChartSection";
import { YearByYearTable } from "./_components/YearByYearTable";
import { ExportProjectionButton } from "./_components/ExportProjectionButton";
import { ValidationBanner } from "@/app/(app)/setup/_components/validation-banner";
import { WhatChangedPanel } from "./_components/WhatChangedPanel";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            View your net worth projection, FI milestones, and year-by-year
            table.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/compare"
            className="text-sm font-medium text-content-muted hover:text-content"
          >
            Compare scenarios →
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
  );
}
