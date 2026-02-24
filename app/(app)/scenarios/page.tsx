"use client";

import { useHouseholdStore } from "@/stores/household";
import { ScenarioEditForm } from "./_components/ScenarioEditForm";
import { ExportScenariosButton } from "./_components/ExportScenariosButton";
import { ValidationBanner } from "@/app/(app)/setup/_components/validation-banner";

export default function ScenariosPage() {
  const { household, activeScenarioId } = useHouseholdStore();
  const scenario = activeScenarioId
    ? household.scenarios.find((s) => s.id === activeScenarioId)
    : null;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Scenarios
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage and compare projection scenarios.
          </p>
        </div>
        <ExportScenariosButton />
      </div>
      <ValidationBanner />
      <div className="mt-8">
        {scenario ? (
          <ScenarioEditForm scenario={scenario} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No scenario selected. Add a scenario from the list.
          </p>
        )}
      </div>
    </div>
  );
}
