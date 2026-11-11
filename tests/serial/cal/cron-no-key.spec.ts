// P5-CAL-CRON-001 (+ MI-9): every cron route under apps/web/app/api/cron/ refuses a missing or wrong
// key and accepts the key from the environment. Route table: src/lanes/cal/cron-routes.ts (fork
// c2b7ac44). Control first: "accepts the key" proves the key reached the route, so a refusal is
// evidence of the check and not of a missing env value (decision D-CAL-B5).
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { CRON_ROUTES, type CronRoute } from "../../../src/lanes/cal/cron-routes.ts";

// 401 from the strict routes (route.ts:19/23/27/11 "Not authenticated"); 403 from the two
// subscription routes ("Forbidden"/"Forbiden"); selected-calendars throws HttpError 401.
const REFUSED_STATUSES: readonly number[] = [401, 403];

function requiredSecret(name: "CRON_API_KEY" | "CRON_SECRET"): string {
  const value = process.env[name];
  // Fail closed: the name only, never the value.
  if (value === undefined || value === "") throw new Error(`ENV_MISSING: ${name}`);
  return value;
}

function routeUrl(route: CronRoute): string {
  return `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}${route.path}`;
}

test.describe("P5-CAL-CRON-001 cron routes", () => {
  for (const route of CRON_ROUTES) {
    test(`P5-CAL-CRON-001 ${route.path} accepts the key`, async ({ request }) => {
      // Control first. Raw key in the authorization header (route.ts:17/25/9/21 read it there).
      const response = await request.fetch(routeUrl(route), {
        method: route.method,
        headers: { authorization: requiredSecret("CRON_API_KEY") },
      });
      expect(response.status(), `${route.keyCheckLine} with the key`).toBeGreaterThanOrEqual(200);
      expect(response.status(), `${route.keyCheckLine} with the key`).toBeLessThan(300);

      if (route.alsoAcceptsBearerCronSecret) {
        const bearer = await request.fetch(routeUrl(route), {
          method: route.method,
          headers: { authorization: `Bearer ${requiredSecret("CRON_SECRET")}` },
        });
        expect(bearer.status(), `${route.keyCheckLine} with Bearer CRON_SECRET`).toBeLessThan(300);
      }
    });

    test(`P5-CAL-CRON-001 ${route.path} refuses a missing key`, async ({ request }) => {
      const url = routeUrl(route);

      const missing = await request.fetch(url, { method: route.method });
      expect(REFUSED_STATUSES, `${route.keyCheckLine} without a key`).toContain(missing.status());

      // MI-9: a wrong key and an empty credential are refused too (plan 5.9).
      const wrong = await request.fetch(url, {
        method: route.method,
        headers: { authorization: "p5-wrong-key-not-a-credential" },
      });
      expect(REFUSED_STATUSES, `${route.keyCheckLine} with a wrong key`).toContain(wrong.status());

      const empty = await request.fetch(url, {
        method: route.method,
        headers: { authorization: "" },
      });
      expect(REFUSED_STATUSES, `${route.keyCheckLine} with an empty credential`).toContain(
        empty.status(),
      );
    });
  }
});
