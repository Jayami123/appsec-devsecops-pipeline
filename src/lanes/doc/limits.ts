// Reads the cited Documenso route limits from the named DOC_ROUTE_LIMITS formula (src/security/budgets.ts).
// Pure. The formula string is the only source: a bare number is never written in a spec for these limits.
import { BUDGETS } from "../../security/budgets.ts";

export type DocRouteLimitName =
  | "authorize"
  | "forgotPassword"
  | "resendVerifyEmail"
  | "verifyEmail"
  | "resetPassword"
  | "upload"
  | "ai";

/** Parses `{ name: 10, other: 3 }` into a map. Throws on any entry that is not `name: integer`. */
export function parseDocRouteLimits(formula: string): Partial<Record<DocRouteLimitName, number>> {
  const inner = formula.trim().replace(/^\{/, "").replace(/\}$/, "");
  const out: Partial<Record<DocRouteLimitName, number>> = {};
  for (const part of inner.split(",")) {
    const match = /^\s*([A-Za-z]+)\s*:\s*(\d+)\s*$/.exec(part);
    if (!match) throw new Error(`TEST BUG: unparseable DOC_ROUTE_LIMITS entry`);
    out[match[1] as DocRouteLimitName] = Number(match[2]);
  }
  return out;
}

/** The cited limit for one route, read from the budget formula by name. */
export function docRouteLimit(name: DocRouteLimitName): number {
  const limit = parseDocRouteLimits(BUDGETS.DOC_ROUTE_LIMITS.formula)[name];
  if (limit === undefined) throw new Error(`TEST BUG: no DOC_ROUTE_LIMITS entry for ${name}`);
  return limit;
}
