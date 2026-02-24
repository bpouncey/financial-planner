"use client";

import { useState } from "react";
import { useHouseholdStore } from "@/stores/household";
import type { EquityGrant, PriceAssumptionMode, VestingEntry } from "@/lib/types/zod";
import { EquityGrantSchema } from "@/lib/types/zod";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { HELP_EQUITY, formatHelpContent } from "@/lib/copy/help";

const inputBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const CURRENT_YEAR = new Date().getFullYear();

interface GrantFormState {
  id: string;
  ownerPersonId: string;
  startYear: string;
  endYear: string;
  vestingEntries: { year: string; shares: string }[];
  priceMode: PriceAssumptionMode;
  fixedPrice: string;
  growthRate: string;
  withholdingRate: string;
  destinationAccountId: string;
}

function emptyFormState(): GrantFormState {
  return {
    id: "",
    ownerPersonId: "",
    startYear: String(CURRENT_YEAR),
    endYear: "",
    vestingEntries: [{ year: String(CURRENT_YEAR), shares: "" }],
    priceMode: "FIXED",
    fixedPrice: "",
    growthRate: "",
    withholdingRate: "0.4",
    destinationAccountId: "",
  };
}

function formStateFromGrant(g: EquityGrant): GrantFormState {
  const entries =
    g.vestingTable.length > 0
      ? g.vestingTable.map((e) => ({
          year: String(e.year),
          shares: String(e.shares),
        }))
      : [{ year: String(g.startYear), shares: "" }];
  return {
    id: g.id,
    ownerPersonId: g.ownerPersonId,
    startYear: String(g.startYear),
    endYear: g.endYear != null ? String(g.endYear) : "",
    vestingEntries: entries,
    priceMode: g.priceAssumption.mode,
    fixedPrice:
      g.priceAssumption.fixedPrice != null
        ? String(g.priceAssumption.fixedPrice)
        : "",
    growthRate:
      g.priceAssumption.growthRate != null
        ? String(g.priceAssumption.growthRate * 100)
        : "",
    withholdingRate: String((g.withholdingRate * 100).toFixed(0)),
    destinationAccountId: g.destinationAccountId,
  };
}

function parseGrantFromForm(state: GrantFormState): EquityGrant | null {
  const startYear = parseInt(state.startYear, 10);
  const endYear = state.endYear.trim()
    ? parseInt(state.endYear, 10)
    : undefined;
  const fixedPrice = parseFloat(state.fixedPrice);
  const growthRate = state.growthRate.trim()
    ? parseFloat(state.growthRate) / 100
    : undefined;
  const withholdingRate = parseFloat(state.withholdingRate) / 100;

  const vestingTable: VestingEntry[] = [];
  for (const e of state.vestingEntries) {
    const year = parseInt(e.year, 10);
    const shares = parseFloat(e.shares);
    if (!isNaN(year) && !isNaN(shares) && shares > 0) {
      vestingTable.push({ year, shares });
    }
  }
  if (vestingTable.length === 0) return null;

  if (state.priceMode === "FIXED" && (isNaN(fixedPrice) || fixedPrice <= 0))
    return null;

  const priceAssumption =
    state.priceMode === "FIXED"
      ? { mode: "FIXED" as const, fixedPrice }
      : {
          mode: "GROWTH" as const,
          growthRate: growthRate ?? 0,
          fixedPrice: fixedPrice > 0 ? fixedPrice : undefined,
        };

  const result = EquityGrantSchema.safeParse({
    id: state.id || crypto.randomUUID(),
    ownerPersonId: state.ownerPersonId,
    type: "RSU",
    startYear,
    endYear,
    vestingTable,
    priceAssumption,
    withholdingRate,
    destinationAccountId: state.destinationAccountId,
  });
  return result.success ? result.data : null;
}

export function EquityGrantsForm() {
  const { household, setEquityGrants } = useHouseholdStore();
  const [formState, setFormState] = useState<GrantFormState>(emptyFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const grants = household.equityGrants ?? [];
  const accounts = household.accounts;
  const people = household.people;

  const taxableOrCashAccounts = accounts.filter(
    (a) => a.type === "TAXABLE" || a.type === "CASH" || a.type === "MONEY_MARKET"
  );

  function handleStartAdd() {
    setEditingId(null);
    setFormState({
      ...emptyFormState(),
      id: crypto.randomUUID(),
      ownerPersonId: people[0]?.id ?? "",
      destinationAccountId:
        taxableOrCashAccounts[0]?.id ?? accounts[0]?.id ?? "",
    });
    setOwnerError(null);
  }

  function handleStartEdit(grant: EquityGrant) {
    setEditingId(grant.id);
    setFormState(formStateFromGrant(grant));
    setOwnerError(null);
  }

  function handleCancel() {
    setEditingId(null);
    setFormState(emptyFormState());
    setOwnerError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.ownerPersonId) {
      setOwnerError("Owner is required");
      return;
    }
    if (!formState.destinationAccountId) return;
    setOwnerError(null);
    const grant = parseGrantFromForm(formState);
    if (!grant) return;
    const next = editingId
      ? grants.map((g) => (g.id === editingId ? grant : g))
      : [...grants, grant];
    setEquityGrants(next);
    handleCancel();
  }

  function handleDelete(id: string) {
    setEquityGrants(grants.filter((g) => g.id !== id));
    if (editingId === id) handleCancel();
  }

  function addVestingRow() {
    const last = formState.vestingEntries[formState.vestingEntries.length - 1];
    const nextYear = last ? parseInt(last.year, 10) + 1 : CURRENT_YEAR;
    setFormState((s) => ({
      ...s,
      vestingEntries: [
        ...s.vestingEntries,
        { year: String(nextYear), shares: "" },
      ],
    }));
  }

  function updateVestingRow(
    index: number,
    field: "year" | "shares",
    value: string
  ) {
    setFormState((s) => {
      const next = [...s.vestingEntries];
      next[index] = { ...next[index]!, [field]: value };
      return { ...s, vestingEntries: next };
    });
  }

  function removeVestingRow(index: number) {
    setFormState((s) => ({
      ...s,
      vestingEntries: s.vestingEntries.filter((_, i) => i !== index),
    }));
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-content">
          RSU / equity grants
        </h2>
        <div className="flex items-center gap-2">
          <HelpTooltip
            content={formatHelpContent(HELP_EQUITY.intro)}
            side="top"
          />
          {!editingId && !formState.id && accounts.length > 0 && people.length > 0 && (
            <button
              type="button"
              onClick={handleStartAdd}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Add grant
            </button>
          )}
        </div>
      </div>

      {(editingId || formState.id) && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-lg border border-border bg-surface-elevated/50 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormFieldWithHelp
              id="grant-owner"
              label="Owner"
              helpContent={formatHelpContent(HELP_EQUITY.owner)}
            >
              <>
                <select
                  id="grant-owner"
                  value={formState.ownerPersonId}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, ownerPersonId: e.target.value }))
                  }
                  className={`${inputBase} ${ownerError ? "border-red-500 dark:border-red-500" : ""}`}
                  required
                >
                  <option value="">Select person</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {ownerError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {ownerError}
                  </p>
                )}
              </>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="grant-destination"
              label="Destination account"
              helpContent={formatHelpContent(HELP_EQUITY.destinationAccount)}
            >
              <select
                id="grant-destination"
                value={formState.destinationAccountId}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    destinationAccountId: e.target.value,
                  }))
                }
                className={inputBase}
                required
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="grant-start-year"
              label="Start year"
              helpContent={formatHelpContent(HELP_EQUITY.startYear)}
            >
              <input
                id="grant-start-year"
                type="number"
                min={CURRENT_YEAR - 5}
                max={CURRENT_YEAR + 30}
                value={formState.startYear}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, startYear: e.target.value }))
                }
                className={inputBase}
              />
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="grant-end-year"
              label="End year (optional)"
              helpContent={formatHelpContent(HELP_EQUITY.endYear)}
            >
              <input
                id="grant-end-year"
                type="number"
                min={CURRENT_YEAR - 5}
                max={CURRENT_YEAR + 30}
                value={formState.endYear}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, endYear: e.target.value }))
                }
                placeholder="Same as last vest"
                className={inputBase}
              />
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="grant-price-mode"
              label="Price assumption"
              helpContent={formatHelpContent(HELP_EQUITY.priceMode)}
            >
              <select
                id="grant-price-mode"
                value={formState.priceMode}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    priceMode: e.target.value as PriceAssumptionMode,
                  }))
                }
                className={inputBase}
              >
                <option value="FIXED">Fixed price</option>
                <option value="GROWTH">Growth rate</option>
              </select>
            </FormFieldWithHelp>
            {formState.priceMode === "FIXED" ? (
              <FormFieldWithHelp
                id="grant-fixed-price"
                label="Price per share ($)"
                helpContent={formatHelpContent(HELP_EQUITY.fixedPrice)}
              >
                <input
                  id="grant-fixed-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.fixedPrice}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, fixedPrice: e.target.value }))
                  }
                  placeholder="0"
                  className={inputBase}
                  required={formState.priceMode === "FIXED"}
                />
              </FormFieldWithHelp>
            ) : (
              <FormFieldWithHelp
                id="grant-growth-rate"
                label="Price growth % per year"
                helpContent={formatHelpContent(HELP_EQUITY.growthRate)}
              >
                <input
                  id="grant-growth-rate"
                  type="number"
                  step="0.1"
                  value={formState.growthRate}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, growthRate: e.target.value }))
                  }
                  placeholder="0"
                  className={inputBase}
                  required={formState.priceMode === "GROWTH"}
                />
              </FormFieldWithHelp>
            )}
            {formState.priceMode === "GROWTH" && (
              <FormFieldWithHelp
                id="grant-fixed-price-growth"
                label="Starting price per share ($)"
                helpContent={formatHelpContent(HELP_EQUITY.fixedPrice)}
              >
                <input
                  id="grant-fixed-price-growth"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.fixedPrice}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, fixedPrice: e.target.value }))
                  }
                  placeholder="0"
                  className={inputBase}
                />
              </FormFieldWithHelp>
            )}
            <FormFieldWithHelp
              id="grant-withholding"
              label="Withholding %"
              helpContent={formatHelpContent(HELP_EQUITY.withholdingRate)}
            >
              <input
                id="grant-withholding"
                type="number"
                step="1"
                min="0"
                max="100"
                value={formState.withholdingRate}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, withholdingRate: e.target.value }))
                }
                className={inputBase}
              />
            </FormFieldWithHelp>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="block text-sm font-medium text-content-muted">
                  Vesting schedule
                </label>
                <HelpTooltip
                  content={formatHelpContent(HELP_EQUITY.vestingTable)}
                  side="top"
                />
              </div>
              <button
                type="button"
                onClick={addVestingRow}
                className="text-sm text-content-muted hover:text-content"
              >
                + Add year
              </button>
            </div>
            <div className="space-y-2">
              {formState.vestingEntries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={CURRENT_YEAR - 5}
                    max={CURRENT_YEAR + 30}
                    value={entry.year}
                    onChange={(e) =>
                      updateVestingRow(i, "year", e.target.value)
                    }
                    placeholder="Year"
                    className={`${inputBase} w-24`}
                  />
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={entry.shares}
                    onChange={(e) =>
                      updateVestingRow(i, "shares", e.target.value)
                    }
                    placeholder="Shares"
                    className={`${inputBase} w-28`}
                  />
                  {formState.vestingEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVestingRow(i)}
                      className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              {editingId ? "Save" : "Add"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-elevated"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {grants.length > 0 && (
        <ul className="mt-4 space-y-3" role="list">
          {grants.map((grant) => {
            const owner = people.find((p) => p.id === grant.ownerPersonId);
            const dest = accounts.find(
              (a) => a.id === grant.destinationAccountId
            );
            const totalShares = grant.vestingTable.reduce(
              (s, e) => s + e.shares,
              0
            );
            return (
              <li
                key={grant.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated py-3 px-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-content">
                    RSU · {owner?.name ?? grant.ownerPersonId}
                  </span>
                  <span className="text-sm text-content-muted">
                    {grant.startYear}
                    {grant.endYear != null ? `–${grant.endYear}` : ""} ·{" "}
                    {totalShares} shares → {dest?.name ?? grant.destinationAccountId}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(grant)}
                    className="rounded-md px-2 py-1 text-sm text-content-muted hover:bg-surface-elevated hover:text-content"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(grant.id)}
                    className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {grants.length === 0 && !editingId && !formState.id && (
        <p className="mt-4 text-sm text-content-muted">
          No RSU grants. Add grants to model vest proceeds flowing to your
          brokerage or cash.
        </p>
      )}

      {(accounts.length === 0 || people.length === 0) && (editingId || formState.id) && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          Add people and accounts first to create equity grants.
        </p>
      )}
    </section>
  );
}
