"use client";

import { useHouseholdStore } from "@/stores/household";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { formatHelpContent, HELP_EMERGENCY_FUND } from "@/lib/copy/help";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

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
    const resolved = id === NONE ? "" : id;
    setEmergencyFundGoal({
      targetAmount,
      accountId: resolved || null,
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
              <Input
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
              />
            </FormFieldWithHelp>
          </div>
          <div className="min-w-[180px] flex-1">
            <FormFieldWithHelp
              id="emergency-fund-account"
              label="Account to track"
              helpContent={formatHelpContent(HELP_EMERGENCY_FUND.account)}
            >
              <Select
                value={accountId || NONE}
                onValueChange={handleAccountChange}
              >
                <SelectTrigger id="emergency-fund-account" className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Select account</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldWithHelp>
          </div>
          {goal && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
