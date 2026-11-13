// P5-CAL-HDR-001: the public booker page of a throwaway user answers 200 and carries the baseline
// security headers. The user is created through the product signup route (self-hosted signup sets
// emailVerified at fork ref held by the owner, so no mail catcher
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

  test("P5-CAL-HDR-001 booker headers: X-Content-Type-Options present, framing is a design verdict", async ({
    request,
  }) => {
    const base = loadEnv().CAL_BASE_URL.replace(/\/$/, "");
    const prefix = currentRunPrefix();
    const username = `${prefix}-hdr`;

    const page = await request.get(`${base}/${username}`);
    expect(page.status(), "precondition: the booker page answers 200").toBe(200);
    const headers = page.headers();
    // Framing (owner rule, same as D-MED-7): a missing frame header on the booker page is a design verdict,
    // not a product bug. The booker is embeddable by design: embed routes exist for it
    // (fork ref held by the owner) and embed.js is served
    // (fork ref held by the owner, :459). X-Frame-Options is set only for /auth and /signup (:427, :436).
    const frameState = {
      xFrameOptions: headers["x-frame-options"] ?? "absent",
      cspFrameAncestors: (headers["content-security-policy"] ?? "").includes("frame-ancestors")
        ? "present"
        : "absent",
    };
    test.info().annotations.push({
      type: "design-verdict",
      description: `booker framing ${JSON.stringify(frameState)}: embeddable by design (fork ref held by the owner, :459; embed routes); depends on CAP-001 for the booker uid page`,
    });
    expect(headers["x-content-type-options"], "X-Content-Type-Options present").toBeDefined();
  });
});
