// Effective configuration readback for the tw-iso rows (X-10, tw-iso.md section 8 rule 5, D-TWISO-B6).
// No product route exposes GRAPHQL_MAX_FIELDS or NODE_ENV to a throwaway actor, so each value carries
// its PROVENANCE: where the value comes from. The behavioural readback (GQL-002 boundary, GQL-005
// anonymous introspection) is recorded by the specs. Names and values only; never a secret.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Fork default for GRAPHQL_MAX_FIELDS: fork ref held by the owner at 7cbdfec6. The harness sets none (F5). */
export const FORK_DEFAULT_GRAPHQL_MAX_FIELDS = 2000;

export interface ReadbackValue<T> {
  readonly value: T;
  /** Where the value comes from (file:line or the proof record). Never a secret. */
  readonly source: string;
}

export interface EffectiveConfig {
  readonly GRAPHQL_MAX_FIELDS: ReadbackValue<number>;
  readonly NODE_ENV: ReadbackValue<string>;
  readonly LOGIC_FUNCTION_TYPE: ReadbackValue<string>;
}

/** Reads the LOGIC_FUNCTION_TYPE the canary proof passed to up, from its proof record (booleans and strings only). */
function logicFunctionTypeFromProof(proofPath: string): ReadbackValue<string> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(proofPath, "utf8"));
    const value =
      typeof parsed === "object" && parsed !== null && "logicFunctionType" in parsed
        ? parsed.logicFunctionType
        : undefined;
    if (typeof value === "string") {
      return { value, source: `${proofPath} (passed to up by canary-proof.ts)` };
    }
  } catch {
    // Missing or unreadable proof: reported below as unknown, never guessed.
  }
  return { value: "unknown", source: "no proof record; LOGIC_FUNCTION_TYPE not passed to up" };
}

/** Provenance readback. Pure apart from reading the proof record. */
export function readEffectiveConfig(
  proofPath: string = join("results", "tw-iso", "p12-proof.json"),
): EffectiveConfig {
  return {
    GRAPHQL_MAX_FIELDS: {
      value: FORK_DEFAULT_GRAPHQL_MAX_FIELDS,
      source:
        "fork default fork ref held by the owner (7cbdfec6); not set by docker/twenty.compose.yml or twenty-passthrough.ts (harness rg: no match)",
    },
    NODE_ENV: {
      value: "unprobed",
      source:
        "image default: fork ref held by the owner gates introspection; no product route exposes it. Behavioural evidence: GQL-005 annotation",
    },
    LOGIC_FUNCTION_TYPE: logicFunctionTypeFromProof(proofPath),
  };
}

/** The NODE_ENV readback from the behaviour of an anonymous introspection request (GQL-005, D-TWISO-B28).
 *  The fork refuses anonymous introspection only in production (fork ref held by the owner; the rule is
 *  fork ref held by the owner). */
export function nodeEnvFromBehaviour(anonymousIntrospectionRefused: boolean): string {
  return anonymousIntrospectionRefused
    ? "production (behavioural, GQL-005)"
    : "not production (behavioural, GQL-005: anonymous introspection answered)";
}

export interface RateLimitReadback {
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly reset: number | null;
}

/** Reads the three rate-limit headers by name. Missing or non-numeric headers give null. */
export function parseRateLimitHeaders(
  headers: Readonly<Record<string, string | undefined>>,
): RateLimitReadback {
  const read = (name: string): number | null => {
    const raw = headers[name];
    if (raw === undefined) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    limit: read("x-ratelimit-limit"),
    remaining: read("x-ratelimit-remaining"),
    reset: read("x-ratelimit-reset"),
  };
}

/** Compares a value a caller forwarded (for example an env var) with the effective value. */
export function compareForwardedEffective(
  forwarded: string,
  effective: string,
): "match" | "ENV mismatch" {
  return forwarded === effective ? "match" : "ENV mismatch";
}
