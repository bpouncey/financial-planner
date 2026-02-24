"use client";

import { useState } from "react";
import { useHouseholdStore } from "@/stores/household";
import type { Event, EventKind } from "@/lib/types/zod";
import { EventSchema } from "@/lib/types/zod";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { HELP_EVENTS, formatHelpContent } from "@/lib/copy/help";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EVENT_KINDS: { value: EventKind; label: string }[] = [
  { value: "INFLOW", label: "Inflow (windfall, bonus)" },
  { value: "OUTFLOW", label: "Outflow (purchase, down payment)" },
];

interface EventFormState {
  id: string;
  name: string;
  year: string;
  amount: string;
  kind: EventKind;
  accountId: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function emptyFormState(): EventFormState {
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
  if (isNaN(year) || isNaN(amount) || !state.accountId) return null;
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

export function EventsForm() {
  const { household, setEvents } = useHouseholdStore();
  const [formState, setFormState] = useState<EventFormState>(emptyFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const events = household.events ?? [];
  const accounts = household.accounts;
  const cashAccounts = accounts.filter((a) => a.type === "CASH");

  function handleStartAdd() {
    setEditingId(null);
    setFormState(emptyFormState());
    setFormState((s) => ({
      ...s,
      id: crypto.randomUUID(),
      accountId: cashAccounts[0]?.id ?? accounts[0]?.id ?? "",
    }));
    setNameError(null);
  }

  function handleStartEdit(event: Event) {
    setEditingId(event.id);
    setFormState(formStateFromEvent(event));
    setNameError(null);
  }

  function handleCancel() {
    setEditingId(null);
    setFormState(emptyFormState());
    setNameError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.name.trim()) {
      setNameError("Name is required");
      return;
    }
    if (!formState.accountId) {
      return;
    }
    setNameError(null);
    const event = parseEventFromForm(formState);
    if (!event) return;
    const next = editingId
      ? events.map((ev) => (ev.id === editingId ? event : ev))
      : [...events, event];
    setEvents(next);
    handleCancel();
  }

  function handleDelete(id: string) {
    setEvents(events.filter((e) => e.id !== id));
    if (editingId === id) handleCancel();
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-content">
          One-time events
        </h2>
        <div className="flex items-center gap-2">
          <HelpTooltip
            content={formatHelpContent(HELP_EVENTS.intro)}
            side="top"
          />
          {!editingId && !formState.id && accounts.length > 0 && (
            <Button type="button" size="sm" onClick={handleStartAdd}>
              Add event
            </Button>
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
              id="event-name"
              label="Name"
              helpContent={formatHelpContent(HELP_EVENTS.name)}
            >
              <>
                <Input
                  id="event-name"
                  type="text"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="e.g. House down payment"
                  aria-invalid={!!nameError}
                />
                {nameError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {nameError}
                  </p>
                )}
              </>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="event-kind"
              label="Type"
              helpContent={formatHelpContent(HELP_EVENTS.kind)}
            >
              <Select
                value={formState.kind}
                onValueChange={(value) =>
                  setFormState((s) => ({
                    ...s,
                    kind: value as EventKind,
                  }))
                }
              >
                <SelectTrigger id="event-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KINDS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="event-year"
              label="Year"
              helpContent={formatHelpContent(HELP_EVENTS.year)}
            >
              <Input
                id="event-year"
                type="number"
                min={CURRENT_YEAR - 5}
                max={CURRENT_YEAR + 50}
                value={formState.year}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, year: e.target.value }))
                }
              />
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="event-amount"
              label="Amount ($)"
              helpContent={formatHelpContent(HELP_EVENTS.amount)}
            >
              <Input
                id="event-amount"
                type="number"
                step="0.01"
                value={formState.amount}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, amount: e.target.value }))
                }
                placeholder="0"
              />
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="event-account"
              label={
                formState.kind === "OUTFLOW"
                  ? "Account (source)"
                  : "Account (destination)"
              }
              helpContent={formatHelpContent(HELP_EVENTS.account)}
            >
              <Select
                value={formState.accountId}
                onValueChange={(value) =>
                  setFormState((s) => ({ ...s, accountId: value }))
                }
                required
              >
                <SelectTrigger id="event-account" className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldWithHelp>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm">
              {editingId ? "Save" : "Add"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {events.length > 0 && (
        <ul className="mt-4 space-y-3" role="list">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated py-3 px-4"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-content">
                  {event.name}
                </span>
                <span className="text-sm text-content-muted">
                  {event.kind} · Year {event.year} · $
                  {event.amount.toLocaleString()}
                  {event.accountId &&
                    ` · ${accounts.find((a) => a.id === event.accountId)?.name ?? event.accountId}`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleStartEdit(event)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                  onClick={() => handleDelete(event.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {events.length === 0 && !editingId && !formState.id && (
        <p className="mt-4 text-sm text-content-muted">
          No one-time events. Add windfalls, bonuses, or large purchases (e.g.
          down payment) to model their impact.
        </p>
      )}

      {accounts.length === 0 && (editingId || formState.id) && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          Add accounts first to assign events to a specific account.
        </p>
      )}
    </section>
  );
}
