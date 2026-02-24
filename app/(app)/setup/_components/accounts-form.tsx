"use client";

import { useState } from "react";
import { useHouseholdStore } from "@/stores/household";
import type { Account, AccountType, Owner } from "@/lib/types/zod";
import { AccountSchema } from "@/lib/types/zod";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { ContributionLimitIndicator } from "@/components/contribution-limit-indicator";
import { getContributionsByAccount, LIMITED_ACCOUNT_TYPES } from "@/lib/model/contribution-limits";
import { HELP_ACCOUNTS, formatHelpContent } from "@/lib/copy/help";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "TAXABLE", label: "Taxable" },
  { value: "MONEY_MARKET", label: "Money Market" },
  { value: "TRADITIONAL", label: "Traditional (401k/IRA)" },
  { value: "403B", label: "403(b)" },
  { value: "ROTH", label: "Roth" },
  { value: "HSA", label: "HSA" },
];

const OWNER_OPTIONS: Owner[] = ["PERSON_A", "PERSON_B", "JOINT"];

function getOwnerLabel(owner: Owner, personAName: string, personBName: string): string {
  switch (owner) {
    case "PERSON_A":
      return personAName;
    case "PERSON_B":
      return personBName;
    case "JOINT":
      return "Joint";
    default:
      return owner;
  }
}

const inputBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

interface AccountFormState {
  id: string;
  name: string;
  type: AccountType;
  owner: Owner;
  startingBalance: string;
  includedInFIAssets: boolean;
  apy: string;
}

const emptyFormState = (): AccountFormState => ({
  id: "",
  name: "",
  type: "TAXABLE",
  owner: "PERSON_A",
  startingBalance: "0",
  includedInFIAssets: true,
  apy: "",
});

function formStateFromAccount(a: Account): AccountFormState {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    owner: a.owner,
    startingBalance: String(a.startingBalance),
    includedInFIAssets: a.includedInFIAssets,
    apy: a.apy != null ? String(a.apy * 100) : "",
  };
}

function parseAccountFromForm(state: AccountFormState): Account | null {
  const startingBalance = parseFloat(state.startingBalance);
  if (isNaN(startingBalance)) return null;
  const apyParsed = state.apy.trim() ? parseFloat(state.apy) / 100 : undefined;
  const apy = apyParsed != null && !isNaN(apyParsed) ? apyParsed : undefined;
  const result = AccountSchema.safeParse({
    id: state.id || crypto.randomUUID(),
    name: state.name.trim(),
    type: state.type,
    owner: state.owner,
    startingBalance,
    includedInFIAssets: state.includedInFIAssets,
    apy: state.type === "MONEY_MARKET" ? apy : undefined,
  });
  return result.success ? result.data : null;
}

export function AccountsForm() {
  const { household, activeScenarioId, addAccount, updateAccount, deleteAccount } =
    useHouseholdStore();
  const [formState, setFormState] = useState<AccountFormState>(emptyFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const personA = household.people.find((p) => p.id === "person-a");
  const personB = household.people.find((p) => p.id === "person-b");
  const personAName = personA?.name ?? "Person A";
  const personBName = personB?.name ?? "Person B";

  function handleStartAdd() {
    setEditingId(null);
    setFormState(emptyFormState());
    setFormState((s) => ({ ...s, id: crypto.randomUUID() }));
    setNameError(null);
  }

  function handleStartEdit(account: Account) {
    setEditingId(account.id);
    setFormState(formStateFromAccount(account));
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
    setNameError(null);
    const account = parseAccountFromForm(formState);
    if (!account) return;
    if (editingId) {
      updateAccount(editingId, {
        name: account.name,
        type: account.type,
        owner: account.owner,
        startingBalance: account.startingBalance,
        includedInFIAssets: account.includedInFIAssets,
        apy: account.apy,
      });
    } else {
      addAccount(account);
    }
    handleCancel();
  }

  function handleDelete(id: string) {
    deleteAccount(id);
    if (editingId === id) handleCancel();
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-content">
          Accounts
        </h2>
        {!editingId && !formState.id && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Add account
          </button>
        )}
      </div>

      {(editingId || formState.id) && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-lg border border-border bg-surface-elevated/50 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormFieldWithHelp
              id="account-name"
              label="Name"
              helpContent={formatHelpContent(HELP_ACCOUNTS.name)}
            >
              <>
                <input
                  id="account-name"
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Vanguard 401k"
                  className={`${inputBase} ${nameError ? "border-red-500 dark:border-red-500" : ""}`}
                />
                {nameError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
                )}
              </>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="account-type"
              label="Type"
              helpContent={formatHelpContent(HELP_ACCOUNTS.type)}
            >
              <select
                id="account-type"
                value={formState.type}
                onChange={(e) => {
                  const newType = e.target.value as AccountType;
                  setFormState((s) => ({
                    ...s,
                    type: newType,
                    apy: newType === "MONEY_MARKET" ? s.apy : "",
                  }));
                }}
                className={inputBase}
              >
                {ACCOUNT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="account-owner"
              label="Owner"
              helpContent={formatHelpContent(HELP_ACCOUNTS.owner)}
            >
              <select
                id="account-owner"
                value={formState.owner}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, owner: e.target.value as Owner }))
                }
                className={inputBase}
              >
                {OWNER_OPTIONS.map((owner) => (
                  <option key={owner} value={owner}>
                    {getOwnerLabel(owner, personAName, personBName)}
                  </option>
                ))}
              </select>
            </FormFieldWithHelp>
            <FormFieldWithHelp
              id="account-balance"
              label="Starting balance ($)"
              helpContent={formatHelpContent(HELP_ACCOUNTS.startingBalance)}
            >
              <input
                id="account-balance"
                type="number"
                step="0.01"
                min="0"
                value={formState.startingBalance}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, startingBalance: e.target.value }))
                }
                className={inputBase}
              />
            </FormFieldWithHelp>
            {formState.type === "MONEY_MARKET" && (
              <FormFieldWithHelp
                id="account-apy"
                label="APY (%)"
                helpContent={formatHelpContent(HELP_ACCOUNTS.apy)}
              >
                <input
                  id="account-apy"
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  placeholder="e.g. 4.5"
                  value={formState.apy}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, apy: e.target.value }))
                  }
                  className={inputBase}
                />
              </FormFieldWithHelp>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                id="account-included-in-fi"
                type="checkbox"
                checked={formState.includedInFIAssets}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, includedInFIAssets: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border bg-surface text-content focus:ring-accent"
              />
              <span className="text-sm text-content-muted">
                Include in FI assets
              </span>
            </label>
            <HelpTooltip
              content={formatHelpContent(HELP_ACCOUNTS.includedInFIAssets)}
              side="top"
            />
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

      {household.accounts.length > 0 && (
        <ul className="mt-4 space-y-3" role="list">
          {household.accounts.map((account) => {
            const scenario =
              household.scenarios.find((s) => s.id === activeScenarioId) ??
              household.scenarios[0];
            const contributions =
              scenario != null
                ? getContributionsByAccount(
                    household,
                    scenario,
                    household.startYear
                  )
                : {};
            const contributed = contributions[account.id] ?? 0;
            const hasLimit = LIMITED_ACCOUNT_TYPES.includes(account.type);

            return (
            <li
              key={account.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated py-3 px-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-content">
                  {account.name}
                </span>
                <span className="text-sm text-content-muted">
                  {account.type} · {getOwnerLabel(account.owner, personAName, personBName)} · $
                  {account.startingBalance.toLocaleString()}
                  {!account.includedInFIAssets && " · excluded from FI"}
                </span>
                {hasLimit && (
                  <div className="mt-2 w-full max-w-[200px]">
                    <ContributionLimitIndicator
                      accountId={account.id}
                      accountType={account.type}
                      contributed={contributed}
                      year={household.startYear}
                      variant="full"
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => handleStartEdit(account)}
                  className="rounded-md px-2 py-1 text-sm text-content-muted hover:bg-surface-elevated hover:text-content"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(account.id)}
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

      {household.accounts.length === 0 && !editingId && !formState.id && (
        <p className="mt-4 text-sm text-content-muted">
          No accounts yet. Click &quot;Add account&quot; to add your first account.
        </p>
      )}
    </section>
  );
}
