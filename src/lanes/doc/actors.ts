// Worker-scoped throwaway actors for the doc lane. Created once per worker through product routes under the
// run prefix. Each actor has its own APIRequestContext (its own cookie jar). Sign-up is limited to 3 per 3 hours
// per IP (rate-limits.ts:5-9), so a worker creates only the actors its project needs; a 429 fails the fixture
// closed (ENV) and is never retried (D-DOC-B21).
import type { APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { apiBaseUrl } from "../../kit/env.ts";
import { currentRunPrefix } from "../../kit/run/prefix.ts";
import { runAllThenRethrow, type CleanupStep } from "../../kit/shared/cleanup.ts";
import { test as laneTest } from "./run-fixture.ts";
import {
  createThrowawayAccount,
  loginThrowaway,
  logoutThrowaway,
  throwawayActor,
  type ActorLabel,
  type ThrowawayActor,
} from "./login.ts";

export interface ActorHandle {
  readonly actor: ThrowawayActor;
  readonly request: APIRequestContext;
}

export interface ActorSet {
  readonly baseUrl: string;
  readonly runPrefix: string;
  readonly byLabel: Partial<Record<ActorLabel, ActorHandle>>;
}

export const DEFAULT_ACTOR_LABELS: readonly ActorLabel[] = ["owner", "other", "org-b-member"];

// This file adds worker-scoped fixtures only, so the empty test-scope type is intentional.
export const test = laneTest.extend<
  // eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
  Record<never, never>,
  { actorLabels: readonly ActorLabel[]; actors: ActorSet }
>({
  actorLabels: [DEFAULT_ACTOR_LABELS, { option: true, scope: "worker" }],
  actors: [
    async ({ playwright, actorLabels }, use) => {
      const baseUrl = apiBaseUrl("documenso");
      const runPrefix = currentRunPrefix();
      const byLabel: Partial<Record<ActorLabel, ActorHandle>> = {};
      const cleanup: CleanupStep[] = [];
      try {
        for (const label of actorLabels) {
          const request = await playwright.request.newContext({ baseURL: baseUrl });
          cleanup.push(() => request.dispose());
          const actor = throwawayActor(runPrefix, label, randomBytes(4).toString("hex"));
          await createThrowawayAccount(request, baseUrl, actor, runPrefix);
          await loginThrowaway(request, baseUrl, actor);
          byLabel[label] = { actor, request };
        }
        await use({ baseUrl, runPrefix, byLabel });
      } finally {
        // Sign each actor out through the product, then dispose its context. Every step runs.
        const signOuts: CleanupStep[] = Object.values(byLabel).map(
          (handle) => () => logoutThrowaway(handle.request, baseUrl),
        );
        await runAllThenRethrow([...signOuts, ...cleanup.reverse()]);
      }
    },
    { scope: "worker" },
  ],
});

export { expect } from "./run-fixture.ts";

/** The handle for one actor. Throws (TEST BUG) when the project did not create that label. */
export function actorOf(actors: ActorSet, label: ActorLabel): ActorHandle {
  const handle = actors.byLabel[label];
  if (!handle) throw new Error(`TEST BUG: actor ${label} was not created by this project`);
  return handle;
}
