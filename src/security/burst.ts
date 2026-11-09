import { BUDGETS, type BudgetName } from "./budgets.ts";

/** Named bursts only: a raw number can never be a budget (tests may not use bare numbers). */
export type BurstBudget = Extract<
  BudgetName,
  "BRUTE_FORCE_ATTEMPTS" | "TOTP_BURST" | "CAL_V2_KEY_LIMIT"
>;

const BURST_NAMES: readonly string[] = ["BRUTE_FORCE_ATTEMPTS", "TOTP_BURST", "CAL_V2_KEY_LIMIT"];

export class BudgetNotNamedError extends Error {
  constructor(value: unknown) {
    super(`BUDGET_NOT_NAMED: ${String(value)}`);
    this.name = "BudgetNotNamedError";
  }
}

/** Returns the named burst count. Throws BUDGET_NOT_NAMED for a raw number or an unknown name. */
export function burstCount(name: unknown): number {
  if (typeof name !== "string" || !BURST_NAMES.includes(name)) {
    throw new BudgetNotNamedError(name);
  }
  const budget = BUDGETS[name as BurstBudget];
  if (typeof budget.value !== "number") {
    throw new BudgetNotNamedError(name);
  }
  return budget.value;
}

/** Calls attempt(0..count-1) in order, one after another. Never waits between attempts. */
export async function runBurst(opts: {
  budget: BurstBudget;
  attempt: (index: number) => Promise<number>;
}): Promise<{ attempts: number; statuses: readonly number[] }> {
  const count = burstCount(opts.budget);
  const statuses: number[] = [];
  for (let index = 0; index < count; index += 1) {
    statuses.push(await opts.attempt(index));
  }
  return { attempts: count, statuses };
}
