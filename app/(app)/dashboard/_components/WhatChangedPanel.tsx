"use client";

import { useHouseholdStore } from "@/stores/household";
import { diffScenarios } from "@/lib/utils/scenario-diff";

export function WhatChangedPanel() {
  const {
    household,
    activeScenarioId,
    projection,
    previousScenarioId,
    previousProjection,
    clearScenarioComparison,
  } = useHouseholdStore();

  if (
    !previousScenarioId ||
    !previousProjection ||
    !projection ||
    activeScenarioId === previousScenarioId
  ) {
    return null;
  }

  const prevScenario = household.scenarios.find(
    (s) => s.id === previousScenarioId
  );
  const currScenario = household.scenarios.find(
    (s) => s.id === activeScenarioId
  );

  if (!prevScenario || !currScenario) {
    return null;
  }

  const prevName = prevScenario.name;
  const currName = currScenario.name;

  const fiYearDelta =
    projection.fiYear != null && previousProjection.fiYear != null
      ? projection.fiYear - previousProjection.fiYear
      : null;

  const coastFiYearDelta =
    projection.coastFiYear != null && previousProjection.coastFiYear != null
      ? projection.coastFiYear - previousProjection.coastFiYear
      : null;

  const drivers = diffScenarios(prevScenario, currScenario);

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-content">
            What changed
            <span className="ml-1.5 font-normal text-content-muted">
              {prevName} → {currName}
            </span>
          </h2>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {fiYearDelta !== null && (
              <div>
                <span className="text-content-muted">FI year: </span>
                <span
                  className={
                    fiYearDelta > 0
                      ? "text-amber-600 dark:text-amber-500"
                      : fiYearDelta < 0
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-content"
                  }
                >
                  {fiYearDelta > 0
                    ? `+${fiYearDelta} years`
                    : fiYearDelta < 0
                      ? `${fiYearDelta} years`
                      : "No change"}
                </span>
              </div>
            )}
            {coastFiYearDelta !== null && fiYearDelta !== coastFiYearDelta && (
              <div>
                <span className="text-content-muted">Coast FI year: </span>
                <span
                  className={
                    coastFiYearDelta > 0
                      ? "text-amber-600 dark:text-amber-500"
                      : coastFiYearDelta < 0
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-content"
                  }
                >
                  {coastFiYearDelta > 0
                    ? `+${coastFiYearDelta} years`
                    : coastFiYearDelta < 0
                      ? `${coastFiYearDelta} years`
                      : "No change"}
                </span>
              </div>
            )}
          </div>

          {drivers.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium uppercase tracking-wider text-content-muted">
                Top drivers
              </p>
              <ul className="space-y-1 text-sm text-content">
                {drivers.map((d) => (
                  <li key={d.label}>
                    <span className="text-content-muted">{d.label}: </span>
                    <span className="line-through opacity-70">{d.from}</span>
                    <span className="mx-1 text-content-muted">→</span>
                    <span>{d.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={clearScenarioComparison}
          className="shrink-0 rounded p-1.5 text-content-muted hover:bg-surface hover:text-content"
          title="Dismiss"
          aria-label="Dismiss what changed panel"
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
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
