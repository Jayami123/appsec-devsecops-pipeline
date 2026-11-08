// Playwright project map for the P5 lanes. Configuration only: no product, secret, env or harness
// import. Listing works with no products running and no browser installed. The project globs
// match spec files only; tests/unit/** (node:test) is never collected here.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Product tests assert exact DB counts: one worker, no retries (a retry would hide a flaky oracle).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    // Raw authenticated traces record request headers, including credentials: never recorded.
    trace: "off",
  },
  projects: [
    { name: "cal", testMatch: ["{contracts,webhooks,integration}/cal/**/*.spec.ts"] },
    {
      name: "cal-ui",
      testMatch: ["ui/cal/**/*.spec.ts"],
      use: { browserName: "chromium" },
    },
    { name: "doc", testMatch: ["{contracts,webhooks,integration}/doc/**/*.spec.ts"] },
    { name: "med", testMatch: ["{contracts,webhooks,integration}/med/**/*.spec.ts"] },
    { name: "tw", testMatch: ["{contracts,webhooks,integration}/tw/**/*.spec.ts"] },
    { name: "tw-iso", testMatch: ["iso/tw/**/*.spec.ts"] },
    // Fresh-stack ordering for this lane is owned by the workflow (a later PR), not by this config.
    { name: "tw-limiter-last", testMatch: ["limiter-last/tw/**/*.spec.ts"] },
    { name: "medusa-closeout", testMatch: ["closeout/medusa/**/*.spec.ts"] },
    { name: "twenty-closeout", testMatch: ["closeout/twenty/**/*.spec.ts"] },
    {
      name: "cal-serial",
      testMatch: ["serial/cal/**/*.spec.ts"],
      dependencies: ["cal"],
    },
    {
      name: "doc-serial",
      testMatch: ["serial/doc/**/*.spec.ts"],
      dependencies: ["doc"],
    },
    {
      name: "med-serial",
      testMatch: ["serial/med/**/*.spec.ts"],
      dependencies: ["med"],
    },
    {
      name: "tw-serial",
      testMatch: ["serial/tw/**/*.spec.ts"],
      dependencies: ["tw"],
    },
  ],
});
