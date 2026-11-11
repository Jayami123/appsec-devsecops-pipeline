// Provisioning test for the doc-serial job (D-DOC-B33). Runs first in the doc-serial project (--no-deps). Signs up
// the serial actors once for the run; the budget is their count (2 at most).
import { test, expect } from "../../../src/lanes/doc/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { actorDir, provisionActors, SERIAL_LABELS } from "../../../src/lanes/doc/actor-store.ts";
import { createThrowawayAccount, type ThrowawayActor } from "../../../src/lanes/doc/login.ts";
import { resolvePersonalTeamId } from "../../../src/lanes/doc/teams.ts";

test.describe("P5-DOC-SETUP", () => {
  test("DOC-SERIAL actors are provisioned once for the run", async ({ playwright, run }) => {
    const base = apiBaseUrl("documenso");
    const manifest = await provisionActors({
      dir: actorDir(run.prefix),
      runPrefix: run.prefix,
      labels: SERIAL_LABELS,
      budget: SERIAL_LABELS.length,
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
    expect(manifest.actors.length).toBe(SERIAL_LABELS.length);
    expect(manifest.signups).toBeLessThanOrEqual(SERIAL_LABELS.length);
  });
});
