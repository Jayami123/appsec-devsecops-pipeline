// P5-CAL-RL-002: an API v2 key is limited to the effective limit per window. The effective limit is read
// from the harness environment through calApiKeyRateLimit() (RATE_LIMIT_DEFAULT_LIMIT_API_KEY, forwarded
// to the API at `up`); it is never taken from the fork default or a literal. The throttler is
// apps/api/v2/src/lib/throttler-guard.ts (api key tracker, default 120 per 60 s). Control: the first
// `limit` requests succeed. Negative: the request after them is 429.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest } from "@playwright/test";
import { calApiKeyRateLimit } from "qa-portfolio-harness";
import {
  createThrowawayActor,
  labelFor,
  v2,
  V2_EVENT_TYPES_VERSION,
  type CalActor,
} from "../../../src/lanes/cal/actor.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

function apiBase(): string {
  return loadEnv().CAL_API_BASE_URL.replace(/\/$/, "");
}

async function newActorWithKey(run: {
  onCleanup(s: () => Promise<void>): void;
}): Promise<CalActor> {
  const actor = await createThrowawayActor(
    loadEnv().CAL_BASE_URL,
    currentRunPrefix(),
    labelFor("rl"),
  );
  run.onCleanup(() => actor.dispose());
  return actor;
}

test.describe("P5-CAL-RL-002 API key limit", () => {
  test("RL-002 requests up to the effective limit succeed", async ({ run }) => {
    const limit = calApiKeyRateLimit();
    const api = await pwRequest.newContext({ baseURL: apiBase() });
    run.onCleanup(() => api.dispose());
    const actor = await newActorWithKey(run);
    const statuses: number[] = [];
    for (let i = 0; i < limit; i += 1) {
      const res = await v2(api, actor.apiKey, "GET", "/v2/event-types", V2_EVENT_TYPES_VERSION);
      statuses.push(res.status);
    }
    const notOk = statuses.filter((s) => s !== 200);
    expect(notOk, `all ${limit} requests within the effective limit answer 200`).toEqual([]);
  });

  test("RL-002 the next request is 429", async ({ run }) => {
    const limit = calApiKeyRateLimit();
    const api = await pwRequest.newContext({ baseURL: apiBase() });
    run.onCleanup(() => api.dispose());
    const actor = await newActorWithKey(run);
    for (let i = 0; i < limit; i += 1) {
      const res = await v2(api, actor.apiKey, "GET", "/v2/event-types", V2_EVENT_TYPES_VERSION);
      expect(res.status, `control: request ${i + 1} of ${limit} answers 200`).toBe(200);
    }
    const next = await v2(api, actor.apiKey, "GET", "/v2/event-types", V2_EVENT_TYPES_VERSION);
    expect(next.status, `request ${limit + 1} is over the effective limit`).toBe(429);
  });
});
