/**
 * Default constants for FI/RE planning model.
 * Per MODEL_RULES §9 and plan spec.
 */

/** Safe withdrawal rate (SWR), decimal. Default 3%. */
export const DEFAULT_SWR = 0.03;

/** Nominal return assumption, decimal. Default 7%. */
export const DEFAULT_NOMINAL_RETURN = 0.07;

/** Inflation assumption, decimal. Default 3%. */
export const DEFAULT_INFLATION = 0.03;

/** Default modeling mode: real dollars (today's dollars) vs nominal. */
export const DEFAULT_MODELING_MODE = "REAL" as const;

/** Age (years) for penalty-free Traditional/403B withdrawals. Use 60 = first full year. */
export const PENALTY_FREE_AGE_TRADITIONAL = 60;

/** Age (years) for penalty-free HSA non-medical withdrawals. */
export const PENALTY_FREE_AGE_HSA = 65;
