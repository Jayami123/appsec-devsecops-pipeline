// Derived from Jayami123/api-webhook-db-test-suite ref 99a2fde src/env.ts (trimmed per F0-2 section 7.2.1; NEW file in this repository). Change here only with a reason in the PR.
import { isIP } from "node:net";
import * as z from "zod";

export type ProductId = "cal" | "documenso" | "medusa" | "twenty";
export const PRODUCT_IDS: readonly ProductId[] = ["cal", "documenso", "medusa", "twenty"];
export type DbRole = "qa_ro" | "qa_fixture";

// Same shape as the run prefix (src/kit/run/prefix.ts RUN_PREFIX_PATTERN). P5_RUN_ID is required.
const RUN_ID_PATTERN = /^p5-qa-\d{8}t\d{6}z-[0-9a-f]{8}$/;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const blankToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const loopbackUrl = z
  .url({ protocol: /^https?$/ })
  .refine((raw) => LOOPBACK_HOSTS.has(new URL(raw).hostname), {
    message: "must point at 127.0.0.1, localhost or [::1]",
  });
/** A malformed URL is a failed validation, not a TypeError (and its text is never echoed). */
function isLoopbackPgUrl(raw: string): boolean {
  if (!/^postgres(ql)?:\/\//.test(raw)) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}
const loopbackPgUrl = z.string().trim().refine(isLoopbackPgUrl, {
  message: "must be a postgres:// URL on 127.0.0.1, localhost or [::1]",
});

/** An explicit IP literal. Wildcards would expose the receiver beyond this machine, so they are refused. */
const WILDCARD_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);
const bindHostList = z
  .string()
  .trim()
  .transform((raw) =>
    raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== ""),
  )
  .pipe(
    z
      .array(
        z.string().refine((host) => isIP(host) !== 0 && !WILDCARD_HOSTS.has(host), {
          message: "must be explicit IP literals (no 0.0.0.0 or ::)",
        }),
      )
      .min(1),
  );

// Defaults are the public local defaults of the pinned P2 contract, with localhost rewritten to
// 127.0.0.1. They are not secrets. Never log a value taken from the environment.
const schema = z.object({
  P5_RUN_ID: z.string().trim().regex(RUN_ID_PATTERN),
  CAL_BASE_URL: z.preprocess(blankToUndefined, loopbackUrl.default("http://127.0.0.1:3000")),
  CAL_API_BASE_URL: z.preprocess(blankToUndefined, loopbackUrl.default("http://127.0.0.1:5555")),
  DOCUMENSO_BASE_URL: z.preprocess(blankToUndefined, loopbackUrl.default("http://127.0.0.1:3001")),
  MEDUSA_BASE_URL: z.preprocess(blankToUndefined, loopbackUrl.default("http://127.0.0.1:9000")),
  TWENTY_BASE_URL: z.preprocess(blankToUndefined, loopbackUrl.default("http://127.0.0.1:3002")),
  CAL_DB_URL: z.preprocess(
    blankToUndefined,
    loopbackPgUrl.default("postgresql://postgres:@127.0.0.1:5450/calendso"),
  ),
  DOCUMENSO_DB_URL: z.preprocess(
    blankToUndefined,
    loopbackPgUrl.default("postgres://documenso:password@127.0.0.1:5451/documenso"),
  ),
  MEDUSA_DB_URL: z.preprocess(
    blankToUndefined,
    loopbackPgUrl.default("postgres://medusa:medusa@127.0.0.1:5433/medusa"),
  ),
  TWENTY_DB_URL: z.preprocess(
    blankToUndefined,
    loopbackPgUrl.default("postgres://postgres:postgres@127.0.0.1:5434/default"),
  ),
  P2_RECEIVER_HOSTS: z.preprocess(blankToUndefined, bindHostList.default(["127.0.0.1"])),
  P2_RECEIVER_PORT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1024).max(65535).default(4317),
  ),
  // Passwords of the two database roles. Optional here: only code that connects as a role needs them.
  P2_QA_RO_PASSWORD: z.preprocess(blankToUndefined, z.string().trim().optional()),
  P2_QA_FIXTURE_PASSWORD: z.preprocess(blankToUndefined, z.string().trim().optional()),
  P2_DB_STATEMENT_TIMEOUT_MS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(100).max(600_000).default(5_000),
  ),
});

export type P2Env = z.infer<typeof schema>;

/**
 * Parse and validate. Errors name the variable only: `ENV_MISSING: <NAME>` or `ENV_INVALID: <NAME>`.
 * Values are never echoed.
 */
export function loadEnv(env: NodeJS.ProcessEnv = process.env): P2Env {
  if (typeof env.P5_RUN_ID !== "string" || env.P5_RUN_ID.trim() === "") {
    throw new Error("ENV_MISSING: P5_RUN_ID");
  }
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path[0];
    throw new Error(`ENV_INVALID: ${typeof first === "string" ? first : "unknown"}`);
  }
  return parsed.data;
}

const BASE_URL_KEY = {
  cal: "CAL_API_BASE_URL",
  documenso: "DOCUMENSO_BASE_URL",
  medusa: "MEDUSA_BASE_URL",
  twenty: "TWENTY_BASE_URL",
} as const satisfies Record<ProductId, keyof P2Env>;
const DB_URL_KEY = {
  cal: "CAL_DB_URL",
  documenso: "DOCUMENSO_DB_URL",
  medusa: "MEDUSA_DB_URL",
  twenty: "TWENTY_DB_URL",
} as const satisfies Record<ProductId, keyof P2Env>;

/** API base URL without a trailing slash. Cal's is API v2 (5555), not the web app. */
export function apiBaseUrl(product: ProductId, env: NodeJS.ProcessEnv = process.env): string {
  return loadEnv(env)[BASE_URL_KEY[product]].replace(/\/$/, "");
}

/** Owner-role URL. Only scripts/db-roles.ts and tests/db may use it (ESLint enforces this). */
export function dbUrl(product: ProductId, env: NodeJS.ProcessEnv = process.env): string {
  return loadEnv(env)[DB_URL_KEY[product]];
}

export function dbStatementTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return loadEnv(env).P2_DB_STATEMENT_TIMEOUT_MS;
}

/** Where the webhook receiver binds. Loopback unless the caller adds more. */
export function receiverConfig(env: NodeJS.ProcessEnv = process.env): {
  readonly hosts: readonly string[];
  readonly port: number;
} {
  const parsed = loadEnv(env);
  return { hosts: parsed.P2_RECEIVER_HOSTS, port: parsed.P2_RECEIVER_PORT };
}

/**
 * Connection string for a role: the product's host, port and database with the role's name and
 * password. Errors never contain a URL or a password.
 */
export function roleDbUrl(
  product: ProductId,
  role: DbRole,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const parsed = loadEnv(env);
  const variable = role === "qa_ro" ? "P2_QA_RO_PASSWORD" : "P2_QA_FIXTURE_PASSWORD";
  const password = role === "qa_ro" ? parsed.P2_QA_RO_PASSWORD : parsed.P2_QA_FIXTURE_PASSWORD;
  if (password === undefined || !/^[A-Za-z0-9_-]{16,128}$/.test(password)) {
    throw new Error(`ENV_INVALID: ${variable}`);
  }
  const url = new URL(dbUrl(product, env));
  url.username = role;
  url.password = password;
  return url.toString();
}
