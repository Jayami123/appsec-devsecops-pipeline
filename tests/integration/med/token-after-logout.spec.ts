// P5-MED-NEW-MED-7 (med plan 3c.20, D-MED-4). The admin token after logout: refused is PASS; still accepted is a deployment note.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { openHarnessAdminSession } from "../../../src/lanes/med/admin-session.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";

test.describe("P5-MED-NEW-MED-7", () => {
  test("NEW-MED-7 control: the admin token reads the admin user before logout", async ({
    request,
  }) => {
    const session = await openHarnessAdminSession();
    const response = await request.fetch(`${apiBaseUrl("medusa")}/admin/users/me`, {
      headers: { authorization: session.authorization },
    });
    expect(response.status(), "control: the token is valid before logout").toBe(200);
  });

  test("NEW-MED-7 the same token after logout is refused or recorded as a deployment note", async ({
    request,
  }, testInfo) => {
    // A dedicated session, so no other test's token is affected (each harness session is its own JWT).
    const session = await openHarnessAdminSession();
    const headers = { authorization: session.authorization };
    const before = await request.fetch(`${apiBaseUrl("medusa")}/admin/users/me`, { headers });
    expect(before.status(), "control: valid before logout").toBe(200);

    // DELETE /auth/session is authenticated with the session only (dist/api/auth/middlewares.js:20-23).
    // A bearer token is not revocable through this route; the outcome is recorded, not assumed.
    const logout = await request.fetch(`${apiBaseUrl("medusa")}/auth/session`, {
      method: "DELETE",
      headers,
    });
    expect([200, 401], "logout answers 200 (session) or 401 (bearer is not a session)").toContain(
      logout.status(),
    );

    const after = await request.fetch(`${apiBaseUrl("medusa")}/admin/users/me`, { headers });
    const refused = after.status() === 401 || after.status() === 403;
    testInfo.annotations.push({
      type: refused ? "pass" : "deployment-finding",
      description: refused
        ? `token refused after logout (logout HTTP ${logout.status()})`
        : `token still accepted after logout (logout HTTP ${logout.status()}, read HTTP ${after.status()}); stateless bearer residual (D-MED-4)`,
    });
    expect(
      [200, 401, 403],
      "the token is either refused or still accepted (no other status)",
    ).toContain(after.status());
  });
});
