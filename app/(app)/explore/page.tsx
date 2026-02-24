"use client";

import Link from "next/link";
import { useHouseholdStore } from "@/stores/household";
import { ScenarioEditForm } from "../scenarios/_components/ScenarioEditForm";
import { ScenarioCompareView } from "../dashboard/_components/ScenarioCompareView";
import { ExportScenariosButton } from "../scenarios/_components/ExportScenariosButton";
import { ValidationBanner } from "@/app/(app)/setup/_components/validation-banner";

export default function ExplorePage() {
  const { household, activeScenarioId } = useHouseholdStore();
  const scenario = activeScenarioId
    ? household.scenarios.find((s) => s.id === activeScenarioId)
    : null;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Explore
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Compare scenarios, override contributions and events, and model
            what-if outcomes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/plan"
            className="text-sm font-medium text-content-muted hover:text-content"
          >
            ← Back to plan
          </Link>
          <ExportScenariosButton />
        </div>
      </div>
      <ValidationBanner />
      <div className="mt-8 space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-medium text-content">
            Scenario settings
          </h2>
          <p className="mb-4 text-sm text-content-muted">
            Edit assumptions, contribution overrides, and scenario-specific
            events for the selected scenario.
          </p>
          {scenario ? (
            <ScenarioEditForm scenario={scenario} />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-surface-elevated">
              <p className="text-sm text-content-muted">
                Select a scenario from the sidebar to edit.
              </p>
            </div>
          )}
        </section>
        <section>
          <ScenarioCompareView />
        </section>
      </div>
    </div>
  );
}
