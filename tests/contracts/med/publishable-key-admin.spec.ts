// P5-MED-AUTHZ-002 (med plan 3c.2). A store publishable key is not an admin credential.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { openRunStore } from "../../../src/lanes/med/setup.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";

test.describe("P5-MED-AUTHZ-002", () => {
  test("P5-MED-AUTHZ-002 control: the admin session reads the admin user", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const response = await request.fetch(`${apiBaseUrl("medusa")}/admin/users/me`, {
      headers: { authorization: store.admin.authorization },
    });
    expect(response.status(), "admin session reads /admin/users/me").toBe(200);
  });

  test("P5-MED-AUTHZ-002 a publishable key alone is refused on the admin route", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    // Negative: the store publishable key with no Authorization header.
    const response = await request.fetch(`${apiBaseUrl("medusa")}/admin/users/me`, {
      headers: { "x-publishable-api-key": store.key.value },
    });
    expect([401, 403], "publishable key alone must be refused on the admin route").toContain(
      response.status(),
    );
  });
});
