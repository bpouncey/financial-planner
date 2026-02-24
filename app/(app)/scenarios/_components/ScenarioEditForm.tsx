"use client";

import { useState } from "react";
import { useHouseholdStore } from "@/stores/household";
import type {
  Scenario,
  ModelingMode,
  ContributionOverride,
  Event,
  EventKind,
} from "@/lib/types/zod";
import { EventSchema } from "@/lib/types/zod";
import {
  DEFAULT_SWR,
  DEFAULT_NOMINAL_RETURN,
  DEFAULT_INFLATION,
} from "@/lib/model/constants";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HELP_FORM, HELP_EVENTS, formatHelpContent } from "@/lib/copy/help";
import { ModelingModeGuide } from "./ModelingModeGuide";

const inputBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatPercent(decimal: number): string {
  if (decimal === 0) return "";
  return String(Math.round(decimal * 1000) / 10);
}

function parsePercent(value: string): number {
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed / 100;
}

const EVENT_KINDS: { value: EventKind; label: string }[] = [
  { value: "INFLOW", label: "Inflow (windfall, bonus)" },
  { value: "OUTFLOW", label: "Outflow (purchase, down payment)" },
];

const CURRENT_YEAR = new Date().getFullYear();

type TaxMode = "take-home" | "effective-rate";

function ContributionOverridesSection({
  scenario,
  household,
  onUpdate,
}: {
  scenario: Scenario;
  household: { people: { id: string; name: string }[]; accounts: { id: string; name: string }[] };
  onUpdate: (overrides: ContributionOverride[]) => void;
}) {
  const overrides = scenario.contributionOverrides ?? [];
  const accounts = household.accounts;
  const people = household.people;

  function handleAdd() {
    const firstAccountId = accounts[0]?.id ?? "";
    const firstPersonId = people[0]?.id;
    const source: ContributionOverride["source"] =
      firstPersonId != null ? "payroll" : "outOfPocket";
    onUpdate([
      ...overrides,
      {
        source,
        personId: source === "payroll" ? firstPersonId : undefined,
        accountId: firstAccountId || "",
        amountAnnual: 0,
      },
    ]);
  }

  function handleUpdate(index: number, patch: Partial<ContributionOverride>) {
    const next = [...overrides];
    next[index] = { ...next[index]!, ...patch };
    onUpdate(next);
  }

  function handleRemove(index: number) {
    onUpdate(overrides.filter((_, i) => i !== index));
  }

  if (accounts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-content">
        Contribution overrides
      </h2>
      <p className="text-sm text-content-muted">
        Override contribution amounts for this scenario only (e.g. &quot;Max 401k: $23,000&quot;).
        Does not change your base plan.
      </p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleAdd}
          className="text-sm text-content-muted hover:text-content"
        >
          + Add override
        </button>
        {overrides.map((o, i) => (
          <ContributionOverrideRow
            key={i}
            override={o}
            accounts={accounts}
            people={people}
            onUpdate={(patch) => handleUpdate(i, patch)}
            onRemove={() => handleRemove(i)}
            rowIndex={i}
          />
        ))}
      </div>
    </section>
  );
}

function ContributionOverrideRow({
  override,
  accounts,
  people,
  onUpdate,
  onRemove,
  rowIndex,
}: {
  override: ContributionOverride;
  accounts: { id: string; name: string }[];
  people: { id: string; name: string }[];
  onUpdate: (patch: Partial<ContributionOverride>) => void;
  onRemove: () => void;
  rowIndex: number;
}) {
  const isPercentMode = override.percentOfIncome != null;
  const amountAnnual = override.amountAnnual ?? (override.amountMonthly ?? 0) * 12;
  const amountMonthly = override.amountMonthly ?? (override.amountAnnual ?? 0) / 12;
  const percentValue = override.percentOfIncome ?? 0;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface/50 p-3">
      <div className="min-w-[100px]">
        <label className="mb-1 block text-xs text-content-muted">Source</label>
        <select
          value={override.source}
          onChange={(e) => {
            const source = e.target.value as ContributionOverride["source"];
            onUpdate({
              source,
              personId: source === "payroll" ? people[0]?.id : undefined,
            });
          }}
          className={inputBase}
        >
          <option value="payroll">Payroll</option>
          <option value="outOfPocket">Out-of-pocket</option>
          <option value="monthlySavings">Monthly savings</option>
        </select>
      </div>
      {override.source === "payroll" && (
        <div className="min-w-[120px]">
          <label className="mb-1 block text-xs text-content-muted">Person</label>
          <select
            value={override.personId ?? ""}
            onChange={(e) => onUpdate({ personId: e.target.value })}
            className={inputBase}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="min-w-[160px] flex-1">
        <label className="mb-1 block text-xs text-content-muted">Account</label>
        <select
          value={override.accountId}
          onChange={(e) => onUpdate({ accountId: e.target.value })}
          className={inputBase}
        >
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={`override-mode-${rowIndex}`}
            checked={!isPercentMode}
            onChange={() =>
              onUpdate({
                percentOfIncome: undefined,
                amountAnnual: amountAnnual || 0,
                amountMonthly: undefined,
              })
            }
            className="h-4 w-4 border-border bg-surface text-content focus:ring-accent"
          />
          <span className="text-xs text-content-muted">$/yr</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={`override-mode-${rowIndex}`}
            checked={isPercentMode}
            onChange={() =>
              onUpdate({
                amountAnnual: undefined,
                amountMonthly: undefined,
                percentOfIncome: percentValue || 0,
              })
            }
            className="h-4 w-4 border-border bg-surface text-content focus:ring-accent"
          />
          <span className="text-xs text-content-muted">%</span>
        </label>
      </div>
      {isPercentMode ? (
        <div className="w-20">
          <label className="mb-1 block text-xs text-content-muted">%</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={percentValue === 0 ? "" : percentValue}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onUpdate({
                percentOfIncome: Number.isNaN(v) ? undefined : v,
                amountAnnual: undefined,
                amountMonthly: undefined,
              });
            }}
            placeholder="0"
            className={inputBase}
          />
        </div>
      ) : (
        <div className="w-28">
          <label className="mb-1 block text-xs text-content-muted">$/yr</label>
          <input
            type="number"
            step="1"
            min="0"
            value={amountAnnual === 0 ? "" : amountAnnual}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onUpdate({
                amountAnnual: Number.isNaN(v) ? undefined : v,
                amountMonthly: undefined,
                percentOfIncome: undefined,
              });
            }}
            placeholder="0"
            className={inputBase}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        Remove
      </button>
    </div>
  );
}

interface EventFormState {
  id: string;
  name: string;
  year: string;
  amount: string;
  kind: EventKind;
  accountId: string;
}

function emptyEventFormState(): EventFormState {
  return {
    id: "",
    name: "",
    year: String(CURRENT_YEAR),
    amount: "",
    kind: "INFLOW",
    accountId: "",
  };
}

function formStateFromEvent(e: Event): EventFormState {
  return {
    id: e.id,
    name: e.name,
    year: String(e.year),
    amount: String(e.amount),
    kind: e.kind,
    accountId: e.accountId ?? "",
  };
}

function parseEventFromForm(state: EventFormState): Event | null {
  const year = parseInt(state.year, 10);
  const amount = parseFloat(state.amount);
  if (Number.isNaN(year) || Number.isNaN(amount) || !state.accountId)
    return null;
  const result = EventSchema.safeParse({
    id: state.id || crypto.randomUUID(),
    name: state.name.trim(),
    year,
    amount,
    kind: state.kind,
    accountId: state.accountId,
  });
  return result.success ? result.data : null;
}

function EventOverridesSection({
  scenario,
  household,
  onUpdate,
}: {
  scenario: Scenario;
  household: { accounts: { id: string; name: string; type: string }[] };
  onUpdate: (events: Event[]) => void;
}) {
  const events = scenario.eventOverrides ?? [];
  const accounts = household.accounts;
  const [formState, setFormState] = useState<EventFormState>(emptyEventFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleStartAdd() {
    setEditingId(null);
    setFormState({
      ...emptyEventFormState(),
      id: crypto.randomUUID(),
      accountId: accounts[0]?.id ?? "",
    });
    setNameError(null);
  }

  function handleStartEdit(event: Event) {
    setEditingId(event.id);
    setFormState(formStateFromEvent(event));
    setNameError(null);
  }

  function handleCancel() {
    setEditingId(null);
    setFormState(emptyEventFormState());
    setNameError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.name.trim()) {
      setNameError("Name is required");
      return;
    }
    if (!formState.accountId) return;
    setNameError(null);
    const event = parseEventFromForm(formState);
    if (!event) return;
    const next = editingId
      ? events.map((ev) => (ev.id === editingId ? event : ev))
      : [...events, event];
    onUpdate(next);
    handleCancel();
  }

  function handleDelete(id: string) {
    onUpdate(events.filter((e) => e.id !== id));
    if (editingId === id) handleCancel();
  }

  if (accounts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-content">
        Scenario-specific events
      </h2>
      <p className="text-sm text-content-muted">
        Add events that apply only when this scenario is active (e.g. &quot;Jillian RSU vest 2027&quot;).
        Does not change your base plan.
      </p>
      <div className="space-y-3">
        {!editingId && !formState.id && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="text-sm text-content-muted hover:text-content"
          >
            + Add event
          </button>
        )}
        {(editingId || formState.id) && (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-surface-elevated/50 p-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldWithHelp
                id="event-override-name"
                label="Name"
                helpContent={formatHelpContent(HELP_EVENTS.name)}
              >
                <>
                  <input
                    id="event-override-name"
                    type="text"
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, name: e.target.value }))
                    }
                    placeholder="e.g. Jillian RSU vest"
                    className={`${inputBase} ${nameError ? "border-red-500 dark:border-red-500" : ""}`}
                  />
                  {nameError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {nameError}
                    </p>
                  )}
                </>
              </FormFieldWithHelp>
              <FormFieldWithHelp
                id="event-override-kind"
                label="Type"
                helpContent={formatHelpContent(HELP_EVENTS.kind)}
              >
                <select
                  id="event-override-kind"
                  value={formState.kind}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      kind: e.target.value as EventKind,
                    }))
                  }
                  className={inputBase}
                >
                  {EVENT_KINDS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormFieldWithHelp>
              <FormFieldWithHelp
                id="event-override-year"
                label="Year"
                helpContent={formatHelpContent(HELP_EVENTS.year)}
              >
                <input
                  id="event-override-year"
                  type="number"
                  min={CURRENT_YEAR - 5}
                  max={CURRENT_YEAR + 50}
                  value={formState.year}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, year: e.target.value }))
                  }
                  className={inputBase}
                />
              </FormFieldWithHelp>
              <FormFieldWithHelp
                id="event-override-amount"
                label="Amount ($)"
                helpContent={formatHelpContent(HELP_EVENTS.amount)}
              >
                <input
                  id="event-override-amount"
                  type="number"
                  step="0.01"
                  value={formState.amount}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, amount: e.target.value }))
                  }
                  placeholder="0"
                  className={inputBase}
                />
              </FormFieldWithHelp>
              <FormFieldWithHelp
                id="event-override-account"
                label={
                  formState.kind === "OUTFLOW"
                    ? "Account (source)"
                    : "Account (destination)"
                }
                helpContent={formatHelpContent(HELP_EVENTS.account)}
              >
                <select
                  id="event-override-account"
                  value={formState.accountId}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, accountId: e.target.value }))
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
        {events.length > 0 && (
          <ul className="space-y-3" role="list">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated py-3 px-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-content">{event.name}</span>
                  <span className="text-sm text-content-muted">
                    {event.kind} · Year {event.year} · $
                    {event.amount.toLocaleString()}
                    {event.accountId &&
                      ` · ${accounts.find((a) => a.id === event.accountId)?.name ?? event.accountId}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(event)}
                    className="rounded-md px-2 py-1 text-sm text-content-muted hover:bg-surface-elevated hover:text-content"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(event.id)}
                    className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ScenarioEditForm({ scenario }: { scenario: Scenario }) {
  const { household, updateScenario } = useHouseholdStore();

  const taxMode: TaxMode =
    scenario.takeHomeAnnual != null ? "take-home" : "effective-rate";

  const handleTaxModeChange = (mode: TaxMode) => {
    if (mode === "take-home") {
      updateScenario(scenario.id, {
        takeHomeAnnual: scenario.takeHomeAnnual ?? 0,
        effectiveTaxRate: null,
      });
    } else {
      updateScenario(scenario.id, {
        effectiveTaxRate: scenario.effectiveTaxRate ?? 0.25,
        takeHomeAnnual: null,
      });
    }
  };

  return (
    <form className="space-y-8">
      {/* Scenario name */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-content">
          Scenario
        </h2>
        <FormFieldWithHelp
          id="scenario-name"
          label="Name"
          helpContent={formatHelpContent(HELP_FORM.scenarioName)}
        >
          <input
            id="scenario-name"
            type="text"
            value={scenario.name}
            onChange={(e) =>
              updateScenario(scenario.id, {
                name: e.target.value.trim() || "Base",
              })
            }
            className={inputBase}
            placeholder="Base"
          />
        </FormFieldWithHelp>
      </section>

      {/* Modeling mode & returns */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-content">
            Modeling
          </h2>
          <ModelingModeGuide />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormFieldWithHelp
            id="modeling-mode"
            label="Mode"
            helpContent={formatHelpContent(HELP_FORM.modelingMode)}
          >
            <select
              id="modeling-mode"
              value={scenario.modelingMode}
              onChange={(e) =>
                updateScenario(scenario.id, {
                  modelingMode: e.target.value as ModelingMode,
                })
              }
              className={inputBase}
            >
              <option value="REAL">Real (today&apos;s dollars)</option>
              <option value="NOMINAL">Nominal</option>
            </select>
          </FormFieldWithHelp>
          <FormFieldWithHelp
            id="nominal-return"
            label="Nominal return (%)"
            helpContent={formatHelpContent(HELP_FORM.nominalReturn)}
          >
            <input
              id="nominal-return"
              type="text"
              inputMode="numeric"
              value={formatPercent(scenario.nominalReturn) || ""}
              onChange={(e) => {
                const v = parsePercent(e.target.value);
                updateScenario(scenario.id, { nominalReturn: v });
              }}
              placeholder={String(DEFAULT_NOMINAL_RETURN * 100)}
              className={inputBase}
            />
          </FormFieldWithHelp>
          <FormFieldWithHelp
            id="inflation"
            label="Inflation (%)"
            helpContent={formatHelpContent(HELP_FORM.inflation)}
          >
            <input
              id="inflation"
              type="text"
              inputMode="numeric"
              value={formatPercent(scenario.inflation) || ""}
              onChange={(e) => {
                const v = parsePercent(e.target.value);
                updateScenario(scenario.id, { inflation: v });
              }}
              placeholder={String(DEFAULT_INFLATION * 100)}
              className={inputBase}
            />
          </FormFieldWithHelp>
          <FormFieldWithHelp
            id="swr"
            label="Safe withdrawal rate (SWR %)"
            helpContent={formatHelpContent(HELP_FORM.swr)}
          >
            <input
              id="swr"
              type="text"
              inputMode="numeric"
              value={formatPercent(scenario.swr) || ""}
              onChange={(e) => {
                const v = parsePercent(e.target.value);
                updateScenario(scenario.id, { swr: v });
              }}
              placeholder={String(DEFAULT_SWR * 100)}
              className={inputBase}
            />
          </FormFieldWithHelp>
        </div>
      </section>

      {/* Tax mode */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-content">
          Tax
        </h2>
        <div className="space-y-4">
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tax-mode"
                checked={taxMode === "take-home"}
                onChange={() => handleTaxModeChange("take-home")}
                className="h-4 w-4 border-border text-accent focus:ring-accent bg-surface"
              />
              <span className="text-sm font-medium text-content">
                Take-home (recommended)
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tax-mode"
                checked={taxMode === "effective-rate"}
                onChange={() => handleTaxModeChange("effective-rate")}
                className="h-4 w-4 border-border text-accent focus:ring-accent bg-surface"
              />
              <span className="text-sm font-medium text-content">
                Effective rate
              </span>
            </label>
          </div>
          {taxMode === "take-home" && (
            <div className="max-w-xs">
              <FormFieldWithHelp
                id="take-home"
                label="Take-home (annual $)"
                helpContent={formatHelpContent(HELP_FORM.takeHomeAnnual)}
              >
                <input
                  id="take-home"
                  type="text"
                  inputMode="numeric"
                  value={
                    scenario.takeHomeAnnual != null
                      ? String(scenario.takeHomeAnnual)
                      : ""
                  }
                  onChange={(e) => {
                    const v = parseCurrency(e.target.value);
                    updateScenario(scenario.id, {
                      takeHomeAnnual: v,
                      effectiveTaxRate: null,
                    });
                  }}
                  placeholder="$0"
                  className={inputBase}
                />
              </FormFieldWithHelp>
            </div>
          )}
          {taxMode === "effective-rate" && (
            <div className="max-w-xs">
              <FormFieldWithHelp
                id="effective-rate"
                label="Effective tax rate (%)"
                helpContent={formatHelpContent(HELP_FORM.effectiveTaxRate)}
              >
                <input
                  id="effective-rate"
                  type="text"
                  inputMode="numeric"
                  value={
                    scenario.effectiveTaxRate != null
                      ? formatPercent(scenario.effectiveTaxRate)
                      : ""
                  }
                  onChange={(e) => {
                    const v = parsePercent(e.target.value);
                    updateScenario(scenario.id, {
                      effectiveTaxRate: v,
                      takeHomeAnnual: null,
                    });
                  }}
                  placeholder="25"
                  className={inputBase}
                />
              </FormFieldWithHelp>
            </div>
          )}
          <div className="max-w-xs">
            <FormFieldWithHelp
              id="retirement-tax-rate"
              label="Retirement tax rate (%)"
              helpContent={formatHelpContent(
                HELP_FORM.retirementEffectiveTaxRate
              )}
            >
              <input
                id="retirement-tax-rate"
                type="text"
                inputMode="numeric"
                value={
                  scenario.retirementEffectiveTaxRate != null
                    ? formatPercent(scenario.retirementEffectiveTaxRate)
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.-]/g, "");
                  if (raw === "") {
                    updateScenario(scenario.id, {
                      retirementEffectiveTaxRate: undefined,
                    });
                    return;
                  }
                  const v = parsePercent(e.target.value);
                  updateScenario(scenario.id, {
                    retirementEffectiveTaxRate: v,
                  });
                }}
                placeholder="0 (no tax)"
                className={inputBase}
              />
            </FormFieldWithHelp>
          </div>
        </div>
      </section>

      {/* Spending & retirement */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-content">
          Spending
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormFieldWithHelp
            id="retirement-spend"
            label="Retirement monthly spend ($)"
            helpContent={formatHelpContent(HELP_FORM.retirementMonthlySpend)}
          >
            <input
              id="retirement-spend"
              type="text"
              inputMode="numeric"
              value={
                scenario.retirementMonthlySpend === 0
                  ? ""
                  : String(scenario.retirementMonthlySpend)
              }
              onChange={(e) => {
                const v = parseCurrency(e.target.value);
                updateScenario(scenario.id, { retirementMonthlySpend: v });
              }}
              placeholder="$5,000"
              className={inputBase}
            />
          </FormFieldWithHelp>
          <FormFieldWithHelp
            id="current-spend"
            label="Current monthly spend ($)"
            helpContent={formatHelpContent(HELP_FORM.currentMonthlySpend)}
          >
            <input
              id="current-spend"
              type="text"
              inputMode="numeric"
              value={
                scenario.currentMonthlySpend != null &&
                scenario.currentMonthlySpend > 0
                  ? String(scenario.currentMonthlySpend)
                  : ""
              }
              onChange={(e) => {
                const v = parseCurrency(e.target.value);
                updateScenario(scenario.id, {
                  currentMonthlySpend: v > 0 ? v : undefined,
                });
              }}
              placeholder="Same as retirement"
              className={inputBase}
            />
          </FormFieldWithHelp>
        </div>
      </section>

      {/* Salary growth override & stress test */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-content">
          Overrides
        </h2>
        <div className="space-y-4">
          <FormFieldWithHelp
            id="salary-growth-mode"
            label="Salary growth"
            helpContent={formatHelpContent(HELP_FORM.salaryGrowthOverride)}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="salary-growth-mode"
                    checked={scenario.salaryGrowthOverride == null}
                    onChange={() =>
                      updateScenario(scenario.id, {
                        salaryGrowthOverride: null,
                      })
                    }
                    className="h-4 w-4 border-border text-accent focus:ring-accent bg-surface"
                  />
                  <span className="text-sm font-medium text-content">
                    Per-person (from Setup)
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="salary-growth-mode"
                    checked={scenario.salaryGrowthOverride != null}
                    onChange={() =>
                      updateScenario(scenario.id, {
                        salaryGrowthOverride:
                          scenario.salaryGrowthOverride ?? 0.03,
                      })
                    }
                    className="h-4 w-4 border-border text-accent focus:ring-accent bg-surface"
                  />
                  <span className="text-sm font-medium text-content">
                    Global override (%)
                  </span>
                </label>
              </div>
              {scenario.salaryGrowthOverride != null && (
                <div className="max-w-xs">
                  <input
                    id="salary-growth-override"
                    type="text"
                    inputMode="numeric"
                    value={formatPercent(scenario.salaryGrowthOverride) || ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.-]/g, "");
                      if (raw === "") {
                        updateScenario(scenario.id, {
                          salaryGrowthOverride: null,
                        });
                        return;
                      }
                      const v = parseFloat(raw) / 100;
                      updateScenario(scenario.id, {
                        salaryGrowthOverride: v,
                      });
                    }}
                    placeholder="3"
                    className={inputBase}
                  />
                </div>
              )}
            </div>
          </FormFieldWithHelp>
          <div className="max-w-xs">
            <FormFieldWithHelp
              id="stress-test"
              label="Stress test: first year return (%)"
              helpContent={formatHelpContent(HELP_FORM.stressTestFirstYearReturn)}
            >
              <input
                id="stress-test"
                type="text"
                inputMode="numeric"
                value={
                  scenario.stressTestFirstYearReturn != null
                    ? formatPercent(scenario.stressTestFirstYearReturn)
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.-]/g, "");
                  if (raw === "") {
                    updateScenario(scenario.id, {
                      stressTestFirstYearReturn: undefined,
                    });
                    return;
                  }
                  const v = parseFloat(raw) / 100;
                  updateScenario(scenario.id, {
                    stressTestFirstYearReturn: v,
                  });
                }}
                placeholder="Normal returns"
                className={inputBase}
              />
            </FormFieldWithHelp>
          </div>
        </div>
      </section>

      {/* Contribution overrides */}
      <ContributionOverridesSection
        scenario={scenario}
        household={household}
        onUpdate={(overrides) =>
          updateScenario(scenario.id, { contributionOverrides: overrides })
        }
      />

      {/* Scenario-specific events */}
      <EventOverridesSection
        scenario={scenario}
        household={household}
        onUpdate={(events) =>
          updateScenario(scenario.id, { eventOverrides: events })
        }
      />
    </form>
  );
}
