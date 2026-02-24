"use client";

import type { Person, Contribution } from "@/lib/types/zod";
import { useHouseholdStore } from "@/stores/household";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HELP_HOUSEHOLD, HELP_PEOPLE, formatHelpEntry } from "@/lib/copy/help";
import { PayrollContributionsForm } from "./contributions-form";

const CURRENT_YEAR = new Date().getFullYear();

const inputBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content shadow-sm placeholder:text-content-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function HouseholdSetupForm() {
  const { household, updateHousehold, updatePerson, setPayrollInvesting } =
    useHouseholdStore();
  const [personA, personB] = household.people;

  return (
    <form className="space-y-8">
      {/* Household basics */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-content">
          Household
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormFieldWithHelp
            id="household-name"
            label="Household name"
            helpContent={formatHelpEntry(HELP_HOUSEHOLD.name)}
          >
            <input
              id="household-name"
              type="text"
              value={household.name}
              onChange={(e) =>
                updateHousehold({ name: e.target.value.trim() || "My Household" })
              }
              className={inputBase}
              placeholder="My Household"
            />
          </FormFieldWithHelp>
          <FormFieldWithHelp
            id="start-year"
            label="Start year"
            helpContent={formatHelpEntry(HELP_HOUSEHOLD.startYear)}
          >
            <input
              id="start-year"
              type="number"
              min={CURRENT_YEAR - 10}
              max={CURRENT_YEAR + 50}
              value={household.startYear}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v))
                  updateHousehold({ startYear: v });
              }}
              className={inputBase}
            />
          </FormFieldWithHelp>
        </div>
      </section>

      {/* Person A */}
      {personA && (
        <PersonForm
          label="Person A"
          person={personA}
          onUpdate={(patch) => updatePerson(personA.id, patch)}
          setPayrollInvesting={(contribs) =>
            setPayrollInvesting(personA.id, contribs)
          }
        />
      )}

      {/* Person B */}
      {personB && (
        <PersonForm
          label="Person B"
          person={personB}
          onUpdate={(patch) => updatePerson(personB.id, patch)}
          setPayrollInvesting={(contribs) =>
            setPayrollInvesting(personB.id, contribs)
          }
        />
      )}
    </form>
  );
}

interface PersonFormProps {
  label: string;
  person: Person;
  onUpdate: (patch: Partial<Person>) => void;
  setPayrollInvesting: (contributions: Contribution[]) => void;
}

function PersonForm({ label, person, onUpdate, setPayrollInvesting }: PersonFormProps) {
  const salary =
    person.income.baseSalaryAnnual === 0
      ? ""
      : String(person.income.baseSalaryAnnual);
  const deductions =
    (person.payroll.payrollDeductionsSpending ?? 0) === 0
      ? ""
      : String(person.payroll.payrollDeductionsSpending);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-content">
        {label}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <FormFieldWithHelp
            id={`${person.id}-name`}
            label="Name"
            helpContent={formatHelpEntry(HELP_PEOPLE.name)}
          >
            <input
              id={`${person.id}-name`}
              type="text"
              value={person.name}
              onChange={(e) =>
                onUpdate({ name: e.target.value.trim() || label })
              }
              className={inputBase}
              placeholder={label}
            />
          </FormFieldWithHelp>
        </div>
        <FormFieldWithHelp
          id={`${person.id}-income`}
          label="Gross income (annual)"
          helpContent={formatHelpEntry(HELP_PEOPLE.baseSalaryAnnual)}
        >
          <input
            id={`${person.id}-income`}
            type="text"
            inputMode="numeric"
            value={salary}
            onChange={(e) => {
              const parsed = parseCurrency(e.target.value);
              onUpdate({
                income: {
                  ...person.income,
                  baseSalaryAnnual: parsed,
                },
              });
            }}
            placeholder="$0"
            className={inputBase}
          />
        </FormFieldWithHelp>
        <FormFieldWithHelp
          id={`${person.id}-salary-growth`}
          label="Salary growth (%)"
          helpContent={formatHelpEntry(HELP_PEOPLE.salaryGrowthRate)}
        >
          <input
            id={`${person.id}-salary-growth`}
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={
              (person.income.salaryGrowthRate ?? 0) === 0
                ? ""
                : String((person.income.salaryGrowthRate ?? 0) * 100)
            }
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              const rate = Number.isNaN(v) ? 0 : v / 100;
              onUpdate({
                income: {
                  ...person.income,
                  salaryGrowthRate: rate,
                },
              });
            }}
            placeholder="0"
            className={inputBase}
          />
        </FormFieldWithHelp>
        <FormFieldWithHelp
          id={`${person.id}-birth-year`}
          label="Birth year"
          helpContent={formatHelpEntry(HELP_PEOPLE.birthYear)}
        >
          <input
            id={`${person.id}-birth-year`}
            type="number"
            min={1900}
            max={CURRENT_YEAR}
            value={person.birthYear ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === "") {
                onUpdate({ birthYear: undefined });
                return;
              }
              const year = parseInt(v, 10);
              if (!Number.isNaN(year)) onUpdate({ birthYear: year });
            }}
            placeholder="Optional"
            className={inputBase}
          />
        </FormFieldWithHelp>
        <FormFieldWithHelp
          id={`${person.id}-deductions`}
          label="Payroll deductions (annual)"
          helpContent={formatHelpEntry(HELP_PEOPLE.payrollDeductionsSpending)}
        >
          <input
            id={`${person.id}-deductions`}
            type="text"
            inputMode="numeric"
            value={deductions}
            onChange={(e) => {
              const parsed = parseCurrency(e.target.value);
              onUpdate({
                payroll: {
                  ...person.payroll,
                  payrollDeductionsSpending: parsed,
                },
              });
            }}
            placeholder="$0"
            className={inputBase}
          />
        </FormFieldWithHelp>
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <PayrollContributionsForm
          personLabel={person.name}
          contributions={person.payroll.payrollInvesting ?? []}
          onUpdate={setPayrollInvesting}
        />
      </div>
    </section>
  );
}
