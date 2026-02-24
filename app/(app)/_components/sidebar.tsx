"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHouseholdStore } from "@/stores/household";

const navItems = [
  { href: "/setup", label: "Setup" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/compare", label: "Compare" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const {
    household,
    activeScenarioId,
    setActiveScenarioId,
    duplicateScenario,
    deleteScenario,
  } = useHouseholdStore();
  const scenarios = household.scenarios;
  const canDelete = scenarios.length > 1;

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-surface-elevated">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight text-content"
        >
          FI/RE Planner
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface text-content"
                  : "text-content-muted hover:bg-surface hover:text-content"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col border-t border-border px-3 py-3">
        <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-content-muted">
          Scenarios
        </span>
        <ul className="flex flex-col gap-0.5">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === activeScenarioId;
            return (
              <li key={scenario.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveScenarioId(scenario.id)}
                  className={`flex-1 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface text-content"
                      : "text-content-muted hover:bg-surface hover:text-content"
                  }`}
                >
                  {scenario.name}
                </button>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateScenario(scenario.id);
                    }}
                    className="rounded p-1 text-content-muted hover:bg-surface hover:text-content"
                    title="Duplicate scenario"
                    aria-label={`Duplicate ${scenario.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16V4a2 2 0 0 1 2-2h12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canDelete) deleteScenario(scenario.id);
                    }}
                    disabled={!canDelete}
                    className="rounded p-1 text-content-muted hover:bg-surface hover:text-content disabled:opacity-40 disabled:cursor-not-allowed"
                    title={canDelete ? "Delete scenario" : "Keep at least one scenario"}
                    aria-label={`Delete ${scenario.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
