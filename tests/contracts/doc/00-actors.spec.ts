// Provisioning test for the doc-api job (D-DOC-B33). Runs first in the doc project (contracts/ sorts before
// integration/ and webhooks/). Signs up the doc-api actors once for the run; the budget is their count (3 at most).
import { test, expect } from "../../../src/lanes/doc/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { actorDir, provisionActors } from "../../../src/lanes/doc/actor-store.ts";
import { createThrowawayAccount, type ThrowawayActor } from "../../../src/lanes/doc/login.ts";
import { resolvePersonalTeamId } from "../../../src/lanes/doc/teams.ts";
import { DOC_API_LABELS } from "../../../src/lanes/doc/actor-store.ts";

test.describe("P5-DOC-SETUP", () => {
  test("DOC-API actors are provisioned once for the run", async ({ playwright, run }) => {
    const base = apiBaseUrl("documenso");
    const manifest = await provisionActors({
      dir: actorDir(run.prefix),
      runPrefix: run.prefix,
      labels: DOC_API_LABELS,
      budget: DOC_API_LABELS.length,
      signUp: async (actor: ThrowawayActor) => {
        const request = await playwright.request.newContext({ baseURL: base });
        try {
          await createThrowawayAccount(request, base, actor, run.prefix);
          const teamId = await resolvePersonalTeamId(request, base);
          return { storageState: await request.storageState(), teamId };
        } finally {
          await request.dispose();
        }
      },
    });
    expect(manifest.actors.length).toBe(DOC_API_LABELS.length);
    expect(manifest.signups).toBeLessThanOrEqual(DOC_API_LABELS.length);
  });
});
