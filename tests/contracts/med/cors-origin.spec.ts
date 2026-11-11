// P5-MED-CORS-001 (med plan 3c.7). The store echoes only the allowed origin.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { ALLOWED_ORIGIN, DISALLOWED_ORIGIN } from "../../../src/lanes/med/fixtures.ts";
import { openRunStore } from "../../../src/lanes/med/setup.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";

test.describe("P5-MED-CORS-001", () => {
  test("P5-MED-CORS-001 control: an allowed store origin is echoed", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const response = await storeRequest(request, {
      method: "GET",
      path: "/store/regions",
      publishableKey: store.key.value,
      origin: ALLOWED_ORIGIN,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  test("P5-MED-CORS-001 a disallowed origin gets no allow-origin header", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const response = await storeRequest(request, {
      method: "GET",
      path: "/store/regions",
      publishableKey: store.key.value,
      origin: DISALLOWED_ORIGIN,
    });
    expect(response.status()).toBe(200);
    expect(
      response.headers()["access-control-allow-origin"],
      "PRODUCT BUG (SUSPECTED) if a disallowed origin is echoed",
    ).toBeUndefined();
  });
});
