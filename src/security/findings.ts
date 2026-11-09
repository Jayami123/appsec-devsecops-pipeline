export type CaseStatus = "planned" | "alias" | "dropped" | "gated";

/** A private-first entry carries exactly an ID and a status: nothing else (AGENTS.md). */
export type PrivateEntry = { readonly id: string; readonly status: "held-private" };

const PRIVATE_KEYS: readonly string[] = ["id", "status"];

/** True only for an object whose keys are exactly id and status, with the held-private status. */
export function isPrivateEntry(x: unknown): x is PrivateEntry {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const keys = Object.keys(x).sort();
  if (keys.length !== PRIVATE_KEYS.length || keys.some((k, i) => k !== PRIVATE_KEYS[i])) {
    return false;
  }
  const record = x as Record<string, unknown>;
  return typeof record["id"] === "string" && record["status"] === "held-private";
}

/** Throws PRIVATE_FIELD_REJECTED for any key other than id and status. Runtime check, not a type. */
export function assertNoPrivateExtras(x: unknown): void {
  if (typeof x !== "object" || x === null) return;
  for (const key of Object.keys(x)) {
    if (!PRIVATE_KEYS.includes(key)) {
      throw new Error(`PRIVATE_FIELD_REJECTED: ${key}`);
    }
  }
}
