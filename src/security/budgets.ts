// P5 named budgets (master plan section 8). Every constant carries its class and basis. A budget is
// never raised to make a test pass (AGENTS.md). Values marked provisional are not yet measured.

export interface Budget {
  readonly value: number | null;
  readonly formula?: string;
  readonly class: "CITED" | "INVESTIGATIVE" | "OPERATIONAL" | "POLICY";
  readonly basis: string;
}

export const BUDGETS = {
  // NIST SP 800-63B-4 cited ceiling 100; 101 is the first attempt past it. Section number UNVERIFIED.
  BRUTE_FORCE_ATTEMPTS: {
    value: 101,
    class: "INVESTIGATIVE",
    basis:
      "first attempt past the cited ceiling of 100 (NIST SP 800-63B-4; section number UNVERIFIED)",
  },
  // RFC 6238 defines a 30 s step but no attempt limit; 20 is P5's bounded probe inside one step.
  TOTP_BURST: {
    value: 20,
    class: "INVESTIGATIVE",
    basis: "P5 bounded probe inside one 30 s TOTP step; not an RFC threshold",
  },
  // Cal throttler-guard.ts:36 default 120 per 60 s TTL; N = effective limit + 1 when overridden.
  CAL_V2_KEY_LIMIT: {
    value: 121,
    class: "CITED",
    basis:
      "Cal throttler-guard.ts:36 default 120 per 60 s window, plus one; default-case value only",
  },
  DOC_ROUTE_LIMITS: {
    value: null,
    formula:
      "{ authorize: 10, forgotPassword: 3, resendVerifyEmail: 3, verifyEmail: 5, resetPassword: 5, upload: 20, ai: 3 }",
    class: "CITED",
    basis: "P6 limiter-contract.ts:14-58 (seven of its ten routes); alias scope only",
  },
  TW_LIMITER_LAYERS: {
    value: null,
    formula:
      "{ apiKeyShort: 100 per 1000 ms, apiKeyLong: 3600 per 60000 ms, application: 500 per 60000 ms }",
    class: "CITED",
    basis: "P6 limiter-profile.ts:10-17 functional profile; image defaults UNPROBED",
  },
  // Throwaway accounts, one attempt each (provisional).
  TW_SPRAY_ACCOUNTS: {
    value: 20,
    class: "INVESTIGATIVE",
    basis: "one attempt per account, recorded per account; provisional",
  },
  // Parallel redemptions of one reset token; exactly one success is the property (provisional).
  CAL_RESET_CONCURRENT_N: {
    value: 5,
    class: "INVESTIGATIVE",
    basis: "one reset token redeemed by 5 parallel requests; provisional",
  },
  // Not Stripe's rule (Stripe's default tolerance is 300 s); an age for the stale-timestamp probe.
  WEBHOOK_STALE_AGE_S: {
    value: 3600,
    class: "INVESTIGATIVE",
    basis: "age for the stale-timestamp probe; not Stripe's 300 s default tolerance",
  },
  SND_FN_TIMEOUT_S: {
    value: 5,
    class: "INVESTIGATIVE",
    basis: "configured per-function timeout set in the test; not proof of driver termination",
  },
  SND_TIMEOUT_MARGIN_S: {
    value: null,
    formula: "max(10, ceil(1.5 * observed spawn overhead))",
    class: "OPERATIONAL",
    basis: "set after the first probe; provisional until probed",
  },
  GQL_DEPTH_PROBE: {
    value: 64,
    class: "INVESTIGATIVE",
    basis: "probe nesting depth; the configured product limit is read first; provisional",
  },
  GQL_ALIAS_PROBE: {
    value: 200,
    class: "INVESTIGATIVE",
    basis: "probe alias count; provisional",
  },
  GQL_BATCH_PROBE: {
    value: 100,
    class: "INVESTIGATIVE",
    basis: "batched operations per request; counting unit UNPROBED; provisional",
  },
  FUZZ_MAX_EXAMPLES: {
    value: 200,
    class: "INVESTIGATIVE",
    basis: "Schemathesis example budget per run; CLI option name UNVERIFIED at the pinned version",
  },
  FUZZ_WALL_MIN: {
    value: 10,
    class: "OPERATIONAL",
    basis: "wall-clock cap for a fuzz job; provisional, revisit after the first run",
  },
  MEM_ALLOC_FRACTION: {
    value: null,
    formula: "1.5 x verified configured limit",
    class: "INVESTIGATIVE",
    basis: "only when the sandbox memory limit is verified; otherwise the row is gated",
  },
  MEM_MAX_ALLOC_MB: {
    value: 512,
    class: "INVESTIGATIVE",
    basis: "cap for the memory probe; provisional",
  },
  LANE_JOB_TIMEOUT_MIN: {
    value: null,
    formula:
      "{ cal: 30, doc: 60, med: 30, tw: 30, twIso: 30, twLimiterLast: 30, closeout: 30, scans: 20 }",
    class: "OPERATIONAL",
    basis: "P2 lane values 30; 60 and 20 are unmeasured provisional estimates",
  },
  ZAP_NIGHTLY_TIMEOUT_MIN: {
    value: 30,
    class: "OPERATIONAL",
    basis: "estimate for passive baseline plus stack start; unmeasured",
  },
  ACCEPTED_RISK_TTL_DAYS: {
    value: 90,
    class: "POLICY",
    basis: "review interval for accepted scanner risks; not a disclosure deadline",
  },
} as const satisfies Record<string, Budget>;

export type BudgetName = keyof typeof BUDGETS;
