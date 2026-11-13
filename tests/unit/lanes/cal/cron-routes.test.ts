import { test } from "node:test";
import assert from "node:assert/strict";
import { CRON_ROUTES, EXTRA_CRON_ROUTE } from "../../../../src/lanes/cal/cron-routes.ts";

test("cron route table has the seven fork ref held by the owner routes, unique paths", () => {
  assert.equal(CRON_ROUTES.length, 7);
  const paths = CRON_ROUTES.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const route of CRON_ROUTES) {
    assert.match(route.path, /^\/api\/cron\/[A-Za-z-]+$/);
  }
  // The eighth cron-style route is recorded separately, never counted in the seven.
  const allPaths: readonly string[] = paths;
  assert.equal(allPaths.includes(EXTRA_CRON_ROUTE.path), false);
});

test("each cron route names its key and whether it also accepts Bearer CRON_SECRET", () => {
  const bearer = new Set(
    CRON_ROUTES.filter((r) => r.alsoAcceptsBearerCronSecret).map((r) => r.path),
  );
  assert.deepEqual([...bearer].sort(), [
    "/api/cron/calendar-subscriptions",
    "/api/cron/calendar-subscriptions-cleanup",
    "/api/cron/selected-calendars",
  ]);
  for (const route of CRON_ROUTES) {
    assert.equal(route.key, "CRON_API_KEY");
    assert.ok(["GET", "POST"].includes(route.method), route.path);
  }
});
