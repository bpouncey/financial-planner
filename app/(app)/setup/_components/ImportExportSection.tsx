"use client";

import { useRef, useState } from "react";
import { useHouseholdStore } from "@/stores/household";
import { HouseholdSchema } from "@/lib/types/zod";
import type { Household } from "@/lib/types/zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CircleAlert } from "lucide-react";

function downloadJson(data: Household, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportSection() {
  const { household, setHousehold } = useHouseholdStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(household, `financial-plan-${date}.json`);
  }

  function handleImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const parsed = JSON.parse(raw) as unknown;

        // Support both raw household or { household: ... } wrapper
        const candidate =
          typeof parsed === "object" &&
          parsed !== null &&
          "household" in parsed &&
          typeof (parsed as { household?: unknown }).household === "object"
            ? (parsed as { household: unknown }).household
            : parsed;

        const householdData = HouseholdSchema.parse(candidate) as Household;
        setHousehold(householdData);
        setImportError(null);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Invalid or corrupted JSON file.";
        setImportError(msg);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected after error
    e.target.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        title="Download household setup as JSON"
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
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleImportClick}
        title="Import household setup from JSON"
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
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden
      />
      {importError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
