"use client";

import { useHouseholdStore } from "@/stores/household";
import type { Contribution, ContributorType } from "@/lib/types/zod";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HELP_CONTRIBUTIONS } from "@/lib/copy/help";

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
  /** When true, show Employee vs Employer selector (401k/403b limits differ). Payroll only. */
  allowContributorType?: boolean;
}

function ContributionRow({
  contribution,
  accounts,
  onUpdate,
  onRemove,
  rowIndex,
  allowPercent = false,
  allowContributorType = false,
}: ContributionRowProps) {
  const isPercentMode = allowPercent && contribution.percentOfIncome != null;
  const contributorType: ContributorType = contribution.contributorType ?? "employee";
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
        <Input
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
        <Input
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
          <Select
            value={contribution.accountId || undefined}
            onValueChange={(value) =>
              onUpdate({ ...contribution, accountId: value })
            }
          >
            <SelectTrigger id={accountId} className="w-full">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormFieldWithHelp>
      </div>
      {allowContributorType && (
        <div className="min-w-[120px]">
          <FormFieldWithHelp
            id={`contrib-${rowIndex}-contributor`}
            label="Type"
            helpContent={formatHelp(HELP_CONTRIBUTIONS.contributorType)}
          >
            <Select
              value={contributorType}
              onValueChange={(value: ContributorType) =>
                onUpdate({ ...contribution, contributorType: value })
              }
            >
              <SelectTrigger id={`contrib-${rowIndex}-contributor`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="employer">Employer</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldWithHelp>
        </div>
      )}
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        Remove
      </Button>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="text-content-muted hover:text-content"
          >
            + Add contribution
          </Button>
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
              allowContributorType
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
          <Button type="button" size="sm" onClick={handleAdd}>
            Add
          </Button>
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
          <Button type="button" size="sm" onClick={handleAdd}>
            Add
          </Button>
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
