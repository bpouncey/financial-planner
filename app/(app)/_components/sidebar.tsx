"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHouseholdStore } from "@/stores/household";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/setup", label: "Setup" },
  { href: "/plan", label: "Plan" },
  { href: "/explore", label: "Explore" },
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
          href="/plan"
          className="text-base font-semibold tracking-tight text-content"
        >
          FI/RE Planner
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Button
              key={href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start px-3",
                isActive
                  ? "bg-surface text-content"
                  : "text-content-muted hover:bg-surface hover:text-content"
              )}
            >
              <Link href={href}>{label}</Link>
            </Button>
          );
        })}
      </nav>
      {pathname.startsWith("/explore") && (
      <div className="flex flex-col border-t border-border px-3 py-3">
        <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-content-muted">
          Scenarios
        </span>
        <ul className="flex flex-col gap-0.5">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === activeScenarioId;
            return (
              <li key={scenario.id} className="group flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveScenarioId(scenario.id)}
                  className={cn(
                    "flex-1 justify-start px-3",
                    isActive
                      ? "bg-surface text-content"
                      : "text-content-muted hover:bg-surface hover:text-content"
                  )}
                >
                  {scenario.name}
                </Button>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateScenario(scenario.id);
                    }}
                    className="text-content-muted hover:bg-surface hover:text-content"
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
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canDelete) deleteScenario(scenario.id);
                    }}
                    disabled={!canDelete}
                    className="text-content-muted hover:bg-surface hover:text-content"
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
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      )}
    </aside>
  );
}
