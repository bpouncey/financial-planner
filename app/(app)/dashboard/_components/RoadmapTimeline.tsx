"use client";

import { useMemo } from "react";
import { useHouseholdStore } from "@/stores/household";
import type { Event } from "@/lib/types/zod";

type TimelineMarker = {
  year: number;
  label: string;
  variant: "fi" | "coast-fi" | "event";
};

function getRetirementYear(
  people: { birthYear?: number }[],
  retirementAgeTarget: number
): number | null {
  const firstPerson = people.find((p) => p.birthYear != null);
  if (!firstPerson?.birthYear) return null;
  return firstPerson.birthYear + retirementAgeTarget;
}

export function RoadmapTimeline() {
  const { household, planProjection } = useHouseholdStore();

  const planScenarioId =
    household.planScenarioId ?? household.scenarios[0]?.id ?? null;
  const planScenario =
    planScenarioId != null
      ? household.scenarios.find((s) => s.id === planScenarioId) ??
        household.scenarios[0] ??
        null
      : null;

  const { markers, startYear, endYear } = useMemo(() => {
    if (!planProjection?.yearRows.length || !planScenario) {
      return { markers: [] as TimelineMarker[], startYear: 0, endYear: 0 };
    }

    const rows = planProjection.yearRows;
    const start = rows[0]!.year;
    const end = rows[rows.length - 1]!.year;
    const markers: TimelineMarker[] = [];

    if (planProjection.fiYear != null && planProjection.fiYear >= start && planProjection.fiYear <= end) {
      markers.push({ year: planProjection.fiYear, label: "FI", variant: "fi" });
    }
    if (
      planProjection.coastFiYear != null &&
      planProjection.coastFiYear >= start &&
      planProjection.coastFiYear <= end
    ) {
      markers.push({
        year: planProjection.coastFiYear,
        label: "Coast FI",
        variant: "coast-fi",
      });
    }

    const retirementYear = getRetirementYear(
      household.people,
      planScenario.retirementAgeTarget
    );
    if (
      retirementYear != null &&
      retirementYear >= start &&
      retirementYear <= end &&
      retirementYear !== planProjection.fiYear
    ) {
      markers.push({
        year: retirementYear,
        label: "Target retirement",
        variant: "event",
      });
    }

    const events = (household.events ?? []) as Event[];
    for (const evt of events) {
      if (evt.year >= start && evt.year <= end) {
        markers.push({
          year: evt.year,
          label: evt.name,
          variant: "event",
        });
      }
    }

    markers.sort((a, b) => a.year - b.year);
    return { markers, startYear: start, endYear: end };
  }, [planProjection, household, planScenario]);

  if (!planProjection?.yearRows.length) return null;

  const hasMarkers = markers.length > 0;

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-content">
        Roadmap
      </h2>
      <div className="rounded-lg border border-border bg-surface-elevated p-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {/* Start year */}
          <span className="inline-flex items-center rounded border border-border bg-surface-elevated px-2 py-1 text-xs font-medium text-content-muted">
            {startYear}
          </span>
          {hasMarkers ? (
            markers.map((m, i) => (
              <span key={`${m.year}-${m.label}-${i}`} className="flex items-center gap-x-2">
                <span
                  className="hidden sm:inline-block h-px w-4 shrink-0 bg-border"
                  aria-hidden
                />
                <span
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium whitespace-nowrap ${
                    m.variant === "fi"
                      ? "bg-success text-success-foreground"
                      : m.variant === "coast-fi"
                        ? "bg-info text-info-foreground"
                        : "border border-border bg-surface-elevated text-content-muted"
                  }`}
                >
                  <span>{m.label}</span>
                  <span className="opacity-90">{m.year}</span>
                </span>
              </span>
            ))
          ) : (
            <p className="text-sm text-content-muted">
              No FI or Coast FI milestones in projection window.
            </p>
          )}
          {/* End year */}
          {hasMarkers && (
            <>
              <span className="hidden sm:inline-block h-px w-4 shrink-0 bg-border" aria-hidden />
              <span className="inline-flex items-center rounded border border-border bg-surface-elevated px-2 py-1 text-xs font-medium text-content-muted">
                {endYear}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
