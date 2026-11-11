// Worker-scoped access to the run's throwaway actors (D-DOC-B33). This fixture NEVER signs up: the sign-up
// happens once per run in a provisioning test (tests/*/doc/00-actors.spec.ts), and every worker, including a
// worker restarted after a failure, loads the stored sessions. Each actor gets its own APIRequestContext with its
// stored cookies. Sessions are not signed out per worker, because a later worker reuses them.
import type { APIRequestContext } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";
import { currentRunPrefix } from "../../kit/run/prefix.ts";
import { loadActors, actorDir } from "./actor-store.ts";
import { test as laneTest } from "./run-fixture.ts";
import type { ActorLabel, ThrowawayActor } from "./login.ts";

export interface ActorHandle {
  readonly actor: ThrowawayActor;
  readonly request: APIRequestContext;
}

export interface ActorSet {
  readonly baseUrl: string;
  readonly runPrefix: string;
  readonly byLabel: Partial<Record<ActorLabel, ActorHandle>>;
}

export const test = laneTest.extend<
  // This file adds worker-scoped fixtures only, so the empty test-scope type is intentional.
  // eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
  Record<never, never>,
  { actors: ActorSet }
>({
  actors: [
    async ({ playwright }, use) => {
      const baseUrl = apiBaseUrl("documenso");
      const runPrefix = currentRunPrefix();
      const contexts: APIRequestContext[] = [];
      const byLabel: Partial<Record<ActorLabel, ActorHandle>> = {};
      try {
        for (const stored of loadActors(actorDir(runPrefix), runPrefix)) {
          const request = await playwright.request.newContext({
            baseURL: baseUrl,
            storageState: stored.storagePath,
            // The product takes the team only from this header (context.ts:27; D-DOC-B45).
            extraHTTPHeaders: { "x-team-id": String(stored.teamId) },
          });
          contexts.push(request);
          byLabel[stored.label] = { actor: stored.actor, request };
        }
        await use({ baseUrl, runPrefix, byLabel });
      } finally {
        for (const context of contexts) await context.dispose();
      }
    },
    { scope: "worker" },
  ],
});

export { expect } from "./run-fixture.ts";

/** The handle for one actor. Throws (TEST BUG) when the run did not provision that label. */
export function actorOf(actors: ActorSet, label: ActorLabel): ActorHandle {
  const handle = actors.byLabel[label];
  if (!handle) throw new Error(`TEST BUG: actor ${label} was not provisioned for this run`);
  return handle;
}
