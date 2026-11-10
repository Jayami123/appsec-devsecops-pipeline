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
    basis:
      "P6 0533e61 src/twenty/limiter-profile.ts:10-17 (functional profile). Fork defaults at 7cbdfec6 (config-variables.ts:1713,1722,1730,1739,1748,1757) are not this budget. Image defaults UNPROBED.",
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
  // Documenso fuzz rate: one below the strictest cited route limit; passed as --rate-limit <value>/<window>.
  FUZZ_RATE_LIMIT: {
    value: 2,
    formula:
      "--rate-limit <value>/<effective limiter window>; the window is read back from the running stack before use (tw-iso X-10)",
    class: "INVESTIGATIVE",
    basis:
      "one below the strictest cited Documenso route limit 3 (DOC_ROUTE_LIMITS forgotPassword, resendVerifyEmail, ai; doc plan F-1 and 4.9); window length UNVERIFIED; provisional",
  },
  // NEW-DOC-3 negatives: text-as-PDF, oversize, polyglot. Control plus cases stays below the upload limit 20.
  DOC_UPLOAD_CASES: {
    value: 3,
    class: "INVESTIGATIVE",
    basis:
      "the three NEW-DOC-3 negatives (doc plan 4.5, doc.md:277, and F-1); control + 3 = 4 uploads, below DOC_ROUTE_LIMITS.upload 20",
  },
  // Documenso upload cap: fork default 50 MiB (not overridden by the harness) plus one byte.
  DOC_UPLOAD_OVERSIZE_BYTES: {
    value: 52_428_801,
    class: "CITED",
    basis:
      "documenso f4105e47 packages/lib/constants/app.ts:5 default 50 MB, files.ts:46-49 rejects size > limit * 1024 * 1024; harness v0.4.0 sets no NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT; effective cap UNPROBED",
  },
  // NEW-TW-6 race trials (owner decision RC-16).
  TW_DEMOTE_RACE_TRIALS: {
    value: 5,
    class: "INVESTIGATIVE",
    basis: "owner decision RC-16 (tw plan); basis P6 src/races/env.ts:38 UNVERIFIED; provisional",
  },
  // Medusa: two parallel requests are the smallest race (structural).
  MED_RACE_PARALLEL_N: {
    value: 2,
    class: "INVESTIGATIVE",
    basis:
      "structural minimum for a race (med plan 3b, med.md:139); NEW-MED-2, NEW-MED-3, NEW-MED-6",
  },
  // Medusa: the same signed bytes delivered twice in total (structural).
  MED_REPLAY_DELIVERIES: {
    value: 2,
    class: "INVESTIGATIVE",
    basis: "one delivery plus one replay (med plan 3b, NEW-MED-5)",
  },
  // expect.poll deadline, never a sleep. No measured value yet.
  WEBHOOK_SETTLE_MS: {
    value: null,
    formula:
      "above the Medusa payment-webhook queue defaults delay 5000 ms x attempts 3 (route.ts:28-29); set from the first measured run",
    class: "OPERATIONAL",
    basis: "med plan 3b and 3c.9; UNPROBED; provisional",
  },
  // X closeout: Medusa async export wait (expect.poll deadline). UNPROBED.
  CSV_EXPORT_POLL_MS: {
    value: null,
    formula: "set from the first live Medusa export run; an expect.poll deadline, never a sleep",
    class: "INVESTIGATIVE",
    basis: "x plan 4.3 and 5.1 (lane foundation budgets); UNPROBED; provisional",
  },
  // X closeout: Twenty UI download wait. UNPROBED.
  CSV_UI_DOWNLOAD_MS: {
    value: null,
    formula:
      "set from the first live Twenty UI export run; a download-event deadline, never a sleep",
    class: "INVESTIGATIVE",
    basis: "x plan 4.3 and 5.2 (D-2); UNPROBED; provisional",
  },
} as const satisfies Record<string, Budget>;

export type BudgetName = keyof typeof BUDGETS;
