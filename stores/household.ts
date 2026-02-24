/**
 * Zustand store for household state and computed projection.
 * Phase 3: household, scenarios, activeScenarioId, projection.
 */

import { create } from "zustand";
import type { Household, Scenario, Person, Account, Contribution, Event, EquityGrant, EmergencyFundGoal } from "@/lib/types/zod";
import { runProjection, type ProjectionResult } from "@/lib/model/engine";
import {
  DEFAULT_SWR,
  DEFAULT_NOMINAL_RETURN,
  DEFAULT_INFLATION,
} from "@/lib/model/constants";
import { HouseholdSchema, ScenarioSchema } from "@/lib/types/zod";

// --- Defaults ---

const CURRENT_YEAR = new Date().getFullYear();

function createDefaultScenario(): Scenario {
  return ScenarioSchema.parse({
    id: "base",
    name: "Base",
    modelingMode: "REAL",
    nominalReturn: DEFAULT_NOMINAL_RETURN,
    inflation: DEFAULT_INFLATION,
    effectiveTaxRate: null,
    takeHomeAnnual: null, // User must set; can default later
    swr: DEFAULT_SWR,
    retirementMonthlySpend: 5000,
    currentMonthlySpend: 5000,
    retirementAgeTarget: 65,
    salaryGrowthOverride: null,
    includeEmployerMatch: false,
  });
}

function createDefaultPerson(id: string, name: string): Person {
  return {
    id,
    name,
    income: {
      baseSalaryAnnual: 0,
      salaryGrowthRate: 0,
      salaryGrowthIsReal: true,
    },
    payroll: {
      payrollInvesting: [],
      payrollDeductionsSpending: 0,
    },
  };
}

function createDefaultHousehold(): Household {
  const baseScenario = createDefaultScenario();
  return HouseholdSchema.parse({
    id: "household-1",
    name: "My Household",
    startYear: CURRENT_YEAR,
    currency: "USD",
    people: [
      createDefaultPerson("person-a", "Person A"),
      createDefaultPerson("person-b", "Person B"),
    ],
    accounts: [],
    scenarios: [baseScenario],
  });
}

function computeInitialProjection(): ProjectionResult {
  const household = createDefaultHousehold();
  const scenario = household.scenarios[0]!;
  return runProjection(household, scenario);
}

// --- Store state ---

export interface HouseholdState {
  household: Household;
  activeScenarioId: string | null;
  projection: ProjectionResult | null;
  /** Previous scenario/projection when user switches; used for What Changed panel. */
  previousScenarioId: string | null;
  previousProjection: ProjectionResult | null;
}

export interface HouseholdActions {
  setHousehold: (household: Household) => void;
  updateHousehold: (patch: Partial<Household>) => void;
  setActiveScenarioId: (id: string | null) => void;
  clearScenarioComparison: () => void;
  addScenario: (scenario: Scenario) => void;
  duplicateScenario: (id: string) => void;
  updateScenario: (id: string, patch: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  addPerson: (person: Person) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addAccount: (account: Account) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  setPayrollInvesting: (personId: string, contributions: Contribution[]) => void;
  setOutOfPocketInvesting: (contributions: Contribution[]) => void;
  setMonthlySavings: (contributions: Contribution[]) => void;
  setEvents: (events: Event[]) => void;
  setEquityGrants: (grants: EquityGrant[]) => void;
  setEmergencyFundGoal: (goal: EmergencyFundGoal | undefined) => void;
  recomputeProjection: () => void;
}

function getActiveScenario(
  household: Household,
  activeScenarioId: string | null
): Scenario | null {
  if (!activeScenarioId) return null;
  return household.scenarios.find((s) => s.id === activeScenarioId) ?? null;
}

/** Ensures activeScenarioId exists in household.scenarios; returns fallback if not. */
function normalizeActiveScenarioId(
  household: Household,
  activeScenarioId: string | null
): string | null {
  if (!household.scenarios.length) return null;
  const exists = activeScenarioId != null &&
    household.scenarios.some((s) => s.id === activeScenarioId);
  return exists ? activeScenarioId : household.scenarios[0]!.id;
}

export const useHouseholdStore = create<HouseholdState & HouseholdActions>()(
  (set, get) => ({
    household: createDefaultHousehold(),
    activeScenarioId: "base",
    projection: computeInitialProjection(),
    previousScenarioId: null,
    previousProjection: null,

    setHousehold: (household) => {
      const { activeScenarioId } = get();
      const normalized = normalizeActiveScenarioId(household, activeScenarioId);
      set({
        household,
        activeScenarioId: normalized,
        projection: null,
      });
      get().recomputeProjection();
    },

    updateHousehold: (patch) => {
      set((state) => {
        const nextHousehold = { ...state.household, ...patch };
        const normalized = normalizeActiveScenarioId(
          nextHousehold,
          state.activeScenarioId
        );
        return {
          household: nextHousehold,
          activeScenarioId: normalized,
          projection: null,
        };
      });
      get().recomputeProjection();
    },

    setActiveScenarioId: (id) => {
      const { activeScenarioId, projection } = get();
      if (id !== activeScenarioId && projection) {
        set({
          previousScenarioId: activeScenarioId,
          previousProjection: projection,
          activeScenarioId: id,
          projection: null,
        });
      } else {
        set({ activeScenarioId: id, projection: null });
      }
      get().recomputeProjection();
    },

    clearScenarioComparison: () => {
      set({ previousScenarioId: null, previousProjection: null });
    },

    addScenario: (scenario) => {
      set((state) => ({
        household: {
          ...state.household,
          scenarios: [...state.household.scenarios, scenario],
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    duplicateScenario: (id) => {
      const scenario = get().household.scenarios.find((s) => s.id === id);
      if (!scenario) return;
      const existingIds = new Set(get().household.scenarios.map((s) => s.id));
      let newId = `scenario-${Date.now()}`;
      while (existingIds.has(newId)) {
        newId = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const copy = ScenarioSchema.parse({
        ...scenario,
        id: newId,
        name: `${scenario.name} (copy)`,
      });
      set((state) => ({
        household: {
          ...state.household,
          scenarios: [...state.household.scenarios, copy],
        },
        activeScenarioId: newId,
        projection: null,
      }));
      get().recomputeProjection();
    },

    updateScenario: (id, patch) => {
      set((state) => ({
        household: {
          ...state.household,
          scenarios: state.household.scenarios.map((s) =>
            s.id === id ? { ...s, ...patch } : s
          ),
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    deleteScenario: (id) => {
      set((state) => {
        const scenarios = state.household.scenarios.filter((s) => s.id !== id);
        const newActive =
          state.activeScenarioId === id
            ? scenarios[0]?.id ?? null
            : state.activeScenarioId;
        return {
          household: { ...state.household, scenarios },
          activeScenarioId: newActive,
          projection: null,
        };
      });
      get().recomputeProjection();
    },

    addPerson: (person) => {
      set((state) => ({
        household: {
          ...state.household,
          people: [...state.household.people, person],
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    updatePerson: (id, patch) => {
      set((state) => ({
        household: {
          ...state.household,
          people: state.household.people.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    deletePerson: (id) => {
      set((state) => ({
        household: {
          ...state.household,
          people: state.household.people.filter((p) => p.id !== id),
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    addAccount: (account) => {
      set((state) => ({
        household: {
          ...state.household,
          accounts: [...state.household.accounts, account],
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    updateAccount: (id, patch) => {
      set((state) => ({
        household: {
          ...state.household,
          accounts: state.household.accounts.map((a) =>
            a.id === id ? { ...a, ...patch } : a
          ),
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    deleteAccount: (id) => {
      set((state) => ({
        household: {
          ...state.household,
          accounts: state.household.accounts.filter((a) => a.id !== id),
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    setPayrollInvesting: (personId, contributions) => {
      set((state) => ({
        household: {
          ...state.household,
          people: state.household.people.map((p) =>
            p.id === personId
              ? { ...p, payroll: { ...p.payroll, payrollInvesting: contributions } }
              : p
          ),
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    setOutOfPocketInvesting: (contributions) => {
      set((state) => ({
        household: {
          ...state.household,
          outOfPocketInvesting: contributions,
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    setMonthlySavings: (contributions) => {
      set((state) => ({
        household: {
          ...state.household,
          monthlySavings: contributions,
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    setEvents: (events) => {
      set((state) => ({
        household: {
          ...state.household,
          events,
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    setEquityGrants: (grants) => {
      set((state) => ({
        household: {
          ...state.household,
          equityGrants: grants,
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    setEmergencyFundGoal: (goal) => {
      set((state) => ({
        household: {
          ...state.household,
          emergencyFundGoal: goal,
        },
        projection: null,
      }));
      get().recomputeProjection();
    },

    recomputeProjection: () => {
      const { household, activeScenarioId } = get();
      const scenario = getActiveScenario(household, activeScenarioId);
      if (!scenario) {
        set({ projection: null });
        return;
      }
      const projection = runProjection(household, scenario);
      set({ projection });
    },
  })
);
