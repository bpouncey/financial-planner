"use client";

import { useHouseholdStore } from "@/stores/household";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { formatHelpContent, HELP_EMERGENCY_FUND } from "@/lib/copy/help";

const inputBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function EmergencyFundGoalForm() {
  const { household, setEmergencyFundGoal } = useHouseholdStore();
  const goal = household.emergencyFundGoal;
  const accounts = household.accounts;

  const targetAmount = goal?.targetAmount ?? 0;
  const accountId = goal?.accountId ?? "";

  function handleTargetChange(value: number) {
    if (value <= 0) {
      setEmergencyFundGoal(undefined);
      return;
    }
    setEmergencyFundGoal({
      targetAmount: value,
      accountId: accountId || null,
    });
  }

  function handleAccountChange(id: string) {
    if (!targetAmount) return;
    setEmergencyFundGoal({
      targetAmount,
      accountId: id || null,
    });
  }

  function handleClear() {
    setEmergencyFundGoal(undefined);
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-content">
        Emergency fund goal
      </h2>
      <p className="mt-1 text-sm text-content-muted">
        Set a target amount and track how long it will take to fund it based on
        your savings and account growth.
      </p>
      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-content-muted">
          Add accounts first, then set your emergency fund goal.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[140px]">
            <FormFieldWithHelp
              id="emergency-fund-target"
              label="Target ($)"
              helpContent={formatHelpContent(HELP_EMERGENCY_FUND.targetAmount)}
            >
              <input
                id="emergency-fund-target"
                type="number"
                step="100"
                min="0"
                value={targetAmount === 0 ? "" : targetAmount}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  handleTargetChange(Number.isNaN(v) ? 0 : v);
                }}
                placeholder="e.g. 15000"
                className={inputBase}
              />
            </FormFieldWithHelp>
          </div>
          <div className="min-w-[180px] flex-1">
            <FormFieldWithHelp
              id="emergency-fund-account"
              label="Account to track"
              helpContent={formatHelpContent(HELP_EMERGENCY_FUND.account)}
            >
              <select
                id="emergency-fund-account"
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className={inputBase}
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
          {goal && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md px-2 py-1.5 text-sm text-content-muted hover:text-content"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </section>
  );
}
