/**
 * planned: a KEEP row not yet run in CI. verified: a test exists and a CI run passed it (the run and file are
 * recorded in `verification`). gated: a named blocker stops the row (the blocker is recorded). alias and dropped
 * are dispositions, not runs. confirmed-product-bug: a public row whose control and negative reproduced; the
 * evidence is in `findings`, and the row carries no `verification`.
 */
export type CaseStatus =
  "planned" | "alias" | "dropped" | "gated" | "verified" | "confirmed-product-bug";

/** The statuses a private-first entry may carry (D-LED-B3). Its details are never in the repository. */
export const PRIVATE_STATUSES: readonly string[] = ["held-private", "confirmed-product-bug"];

/** A private-first entry carries exactly an ID and a status: nothing else (AGENTS.md). */
export type PrivateEntry = {
  readonly id: string;
  readonly status: "held-private" | "confirmed-product-bug";
};

const PRIVATE_KEYS: readonly string[] = ["id", "status"];

/**
 * The private-first IDs named by a parsed ledger, in ledger order. Throws when the private array is missing or an
 * entry is not exactly {id, status} with an allowed private status (fail closed: a bad ledger must not disable
 * redaction).
 */
export function privateIdsOf(ledger: unknown): string[] {
  const list =
    typeof ledger === "object" && ledger !== null
      ? (ledger as { readonly private?: unknown }).private
      : undefined;
  if (!Array.isArray(list)) throw new Error("ledger.private is missing or not an array");
  return list.map((entry: unknown) => {
    if (!isPrivateEntry(entry))
      throw new Error("ledger.private entry is not {id, status} with an allowed private status");
    return entry.id;
  });
}

/** The first private ID that appears in `text` as a whole token (so MI-3 does not match MI-30), or undefined. */
export function privateIdIn(text: string, ids: readonly string[]): string | undefined {
  for (const id of ids) {
    const token = new RegExp(
      `(?<![A-Za-z0-9-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9-])`,
    );
    if (token.test(text)) return id;
  }
  return undefined;
}

/** True only for an object whose keys are exactly id and status, with an allowed private status. */
export function isPrivateEntry(x: unknown): x is PrivateEntry {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const keys = Object.keys(x).sort();
  if (keys.length !== PRIVATE_KEYS.length || keys.some((k, i) => k !== PRIVATE_KEYS[i])) {
    return false;
  }
  const record = x as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    typeof record["status"] === "string" &&
    PRIVATE_STATUSES.includes(record["status"])
  );
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
