"use client";

import { useHouseholdStore } from "@/stores/household";
import type { Contribution } from "@/lib/types/zod";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HELP_CONTRIBUTIONS } from "@/lib/copy/help";

const inputBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function formatHelp(entry: { description: string; example?: string }): string {
  return entry.example ? `${entry.description} Example: ${entry.example}.` : entry.description;
}

interface ContributionRowProps {
  contribution: Contribution;
  accounts: { id: string; name: string }[];
  onUpdate: (c: Contribution) => void;
  onRemove: () => void;
  rowIndex: number;
  /** When true, show Fixed ($/mo) vs % of income toggle. Payroll only. */
  allowPercent?: boolean;
}

function ContributionRow({
  contribution,
  accounts,
  onUpdate,
  onRemove,
  rowIndex,
  allowPercent = false,
}: ContributionRowProps) {
  const isPercentMode = allowPercent && contribution.percentOfIncome != null;
  const amountMonthly =
    contribution.amountMonthly ?? (contribution.amountAnnual ?? 0) / 12;
  const percentValue = contribution.percentOfIncome ?? 0;
  const accountId = `contrib-${rowIndex}-account`;
  const amountId = `contrib-${rowIndex}-amount`;
  const percentId = `contrib-${rowIndex}-percent`;

  const fixedAmountField = (
    <div className="w-28">
      <FormFieldWithHelp
        id={amountId}
        label="$/mo"
        helpContent={formatHelp(HELP_CONTRIBUTIONS.amountMonthly)}
      >
        <input
          id={amountId}
          type="number"
          step="1"
          min="0"
          value={amountMonthly === 0 ? "" : amountMonthly}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onUpdate({
              ...contribution,
              amountMonthly: Number.isNaN(v) ? undefined : v,
              amountAnnual: undefined,
              percentOfIncome: undefined,
            });
          }}
          placeholder="0"
          className={inputBase}
        />
      </FormFieldWithHelp>
    </div>
  );

  const percentField = (
    <div className="w-24">
      <FormFieldWithHelp
        id={percentId}
        label="%"
        helpContent={formatHelp(HELP_CONTRIBUTIONS.percentOfIncome)}
      >
        <input
          id={percentId}
          type="number"
          step="0.5"
          min="0"
          max="100"
          value={percentValue === 0 ? "" : percentValue}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onUpdate({
              ...contribution,
              percentOfIncome: Number.isNaN(v) ? undefined : v,
              amountMonthly: undefined,
              amountAnnual: undefined,
            });
          }}
          placeholder="0"
          className={inputBase}
        />
      </FormFieldWithHelp>
    </div>
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[160px] flex-1">
        <FormFieldWithHelp
          id={accountId}
          label="Account"
          helpContent={formatHelp(HELP_CONTRIBUTIONS.account)}
        >
          <select
            id={accountId}
            value={contribution.accountId}
            onChange={(e) => onUpdate({ ...contribution, accountId: e.target.value })}
            className={inputBase}
            required
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormFieldWithHelp>
      </div>
      {allowPercent ? (
        <>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`contrib-mode-${rowIndex}`}
                checked={!isPercentMode}
                onChange={() =>
                  onUpdate({
                    ...contribution,
                    percentOfIncome: undefined,
                    amountMonthly: amountMonthly || 0,
                    amountAnnual: undefined,
                  })
                }
                className="h-4 w-4 border-border bg-surface text-content focus:ring-accent"
              />
              <span className="text-sm text-content-muted">
                $/mo
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`contrib-mode-${rowIndex}`}
                checked={isPercentMode}
                onChange={() =>
                  onUpdate({
                    ...contribution,
                    amountMonthly: undefined,
                    amountAnnual: undefined,
                    percentOfIncome: percentValue || 0,
                  })
                }
                className="h-4 w-4 border-border bg-surface text-content focus:ring-accent"
              />
              <span className="text-sm text-content-muted">
                % of income
              </span>
            </label>
          </div>
          {isPercentMode ? percentField : fixedAmountField}
        </>
      ) : (
        fixedAmountField
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

export function PayrollContributionsForm({
  contributions,
  onUpdate,
  personLabel,
}: {
  contributions: Contribution[];
  onUpdate: (contributions: Contribution[]) => void;
  personLabel: string;
}) {
  const { household } = useHouseholdStore();
  const accounts = household.accounts;

  function handleAdd() {
    const firstAccountId = accounts[0]?.id ?? "";
    onUpdate([
      ...contributions,
      { accountId: firstAccountId || "", amountMonthly: 0 },
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-content-muted">
          Payroll investing — {personLabel}
        </h3>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={handleAdd}
            className="text-sm text-content-muted hover:text-content"
          >
            + Add contribution
          </button>
        )}
      </div>
      {accounts.length === 0 ? (
        <p className="text-sm text-content-muted">
          Add accounts first, then link payroll contributions.
        </p>
      ) : (
        <div className="space-y-2">
          {contributions.map((c, i) => (
            <ContributionRow
              key={i}
              contribution={c}
              accounts={accounts}
              rowIndex={i}
              allowPercent
              onUpdate={(updated) => {
                const next = [...contributions];
                next[i] = updated;
                onUpdate(next);
              }}
              onRemove={() => onUpdate(contributions.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MonthlySavingsForm() {
  const { household, setMonthlySavings } = useHouseholdStore();
  const contributions = household.monthlySavings ?? [];
  const accounts = household.accounts;

  function handleAdd() {
    const firstAccountId = accounts[0]?.id ?? "";
    setMonthlySavings([
      ...contributions,
      { accountId: firstAccountId || "", amountMonthly: 0 },
    ]);
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-content">
          Monthly savings
        </h2>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Add
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-content-muted">
        Regular savings into accounts (e.g. emergency fund, HYSA). Add
        accounts first.
      </p>
      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-content-muted">
          No accounts yet. Add accounts above, then add monthly savings.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {contributions.map((c, i) => (
            <ContributionRow
              key={i}
              contribution={c}
              accounts={accounts}
              rowIndex={i}
              onUpdate={(updated) => {
                const next = [...contributions];
                next[i] = updated;
                setMonthlySavings(next);
              }}
              onRemove={() =>
                setMonthlySavings(contributions.filter((_, j) => j !== i))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function OutOfPocketForm() {
  const { household, setOutOfPocketInvesting } = useHouseholdStore();
  const contributions = household.outOfPocketInvesting ?? [];
  const accounts = household.accounts;

  function handleAdd() {
    const firstAccountId = accounts[0]?.id ?? "";
    setOutOfPocketInvesting([
      ...contributions,
      { accountId: firstAccountId || "", amountMonthly: 0 },
    ]);
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-content">
          Out-of-pocket investing
        </h2>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Add
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-content-muted">
        Money from take-home (after taxes) invested into accounts. Add accounts
        first.
      </p>
      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-content-muted">
          No accounts yet. Add accounts above, then add out-of-pocket
          contributions.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {contributions.map((c, i) => (
            <ContributionRow
              key={i}
              contribution={c}
              accounts={accounts}
              rowIndex={i}
              onUpdate={(updated) => {
                const next = [...contributions];
                next[i] = updated;
                setOutOfPocketInvesting(next);
              }}
              onRemove={() =>
                setOutOfPocketInvesting(contributions.filter((_, j) => j !== i))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
