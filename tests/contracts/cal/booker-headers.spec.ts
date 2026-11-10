// P5-CAL-HDR-001: the public booker page of a throwaway user answers 200 and carries the baseline
// security headers. The user is created through the product signup route (self-hosted signup sets
// emailVerified at apps/web/app/api/auth/signup/handlers/selfHostedHandler.ts:45, so no mail catcher
// is needed). The user has no delete route in the fork; it is retained under the run prefix on the
// ephemeral CI stack (decision D-CAL-B20).
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import {
  assertThrowawayEmail,
  throwawayEmail,
  throwawayPassword,
} from "../../../src/lanes/cal/login.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

test.describe("P5-CAL-HDR-001 booker page", () => {
  test("P5-CAL-HDR-001 booker page answers 200", async ({ request }) => {
    const base = loadEnv().CAL_BASE_URL.replace(/\/$/, "");
    const prefix = currentRunPrefix();
    const email = throwawayEmail(prefix, "hdr");
    assertThrowawayEmail(email, prefix);
    const username = `${prefix}-hdr`;

    const signup = await request.post(`${base}/api/auth/signup`, {
      headers: { "content-type": "application/json" },
      data: { email, password: throwawayPassword(), username },
    });
    expect(signup.status(), "throwaway signup (selfHostedHandler.ts)").toBeLessThan(300);

    const page = await request.get(`${base}/${username}`);
    expect(page.status(), "booker page answers 200").toBe(200);
  });

  test("P5-CAL-HDR-001 booker headers include X-Frame-Options and X-Content-Type-Options", async ({
    request,
  }) => {
    const base = loadEnv().CAL_BASE_URL.replace(/\/$/, "");
    const prefix = currentRunPrefix();
    const username = `${prefix}-hdr`;

    const page = await request.get(`${base}/${username}`);
    expect(page.status(), "precondition: the booker page answers 200").toBe(200);
    const headers = page.headers();
    expect(headers["x-frame-options"], "X-Frame-Options present").toBeDefined();
    expect(headers["x-content-type-options"], "X-Content-Type-Options present").toBeDefined();
  });
});
