"use client";

import { useHouseholdStore } from "@/stores/household";
import type { Scenario, ModelingMode } from "@/lib/types/zod";
import {
  DEFAULT_SWR,
  DEFAULT_NOMINAL_RETURN,
  DEFAULT_INFLATION,
} from "@/lib/model/constants";
import { FormFieldWithHelp } from "@/components/ui/form-field-with-help";
import { HELP_FORM, formatHelpContent } from "@/lib/copy/help";
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

type TaxMode = "take-home" | "effective-rate";

export function ScenarioEditForm({ scenario }: { scenario: Scenario }) {
  const updateScenario = useHouseholdStore((s) => s.updateScenario);

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
    </form>
  );
}
