"use client";

import { createContext, useContext } from "react";

const PlanViewContext = createContext(false);

export function PlanViewProvider({ children }: { children: React.ReactNode }) {
  return (
    <PlanViewContext.Provider value={true}>{children}</PlanViewContext.Provider>
  );
}

export function usePlanView(): boolean {
  return useContext(PlanViewContext);
}
