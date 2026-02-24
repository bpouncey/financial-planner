"use client";

import Link from "next/link";
import { ScenarioCompareView } from "../_components/ScenarioCompareView";
import { ValidationBanner } from "@/app/(app)/setup/_components/validation-banner";

export default function ComparePage() {
  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Compare scenarios
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Overlay Invested Assets and Net Worth for up to 3 scenarios.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-content-muted hover:text-content"
        >
          ← Back to dashboard
        </Link>
      </div>
      <ValidationBanner />
      <div className="mt-8">
        <ScenarioCompareView />
      </div>
    </div>
  );
}
