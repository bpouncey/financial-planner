"use client";

import { useHouseholdStore } from "@/stores/household";
import { downloadProjectionCsv } from "@/lib/utils/export-projection";

export function ExportProjectionButton() {
  const { projection, household, activeScenarioId } = useHouseholdStore();

  const scenario =
    household.scenarios.find((s) => s.id === activeScenarioId) ??
    household.scenarios[0] ?? null;
  const scenarioName = scenario?.name ?? "projection";
  const disabled = !projection?.yearRows?.length;

  function handleExport() {
    if (!projection?.yearRows?.length) return;
    downloadProjectionCsv(projection, household, { scenarioName });
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
      title={disabled ? "Complete setup to export" : "Download projection as CSV"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      Export
    </button>
  );
}
