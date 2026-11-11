// P5-MED-HDR-001 (med plan 3c.8, owner decision D-MED-7). Missing headers are a deployment finding, never PRODUCT BUG.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { openRunStore } from "../../../src/lanes/med/setup.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";

test.describe("P5-MED-HDR-001", () => {
  test("P5-MED-HDR-001 control: the admin app answers 200", async ({ request }) => {
    const response = await request.fetch(`${apiBaseUrl("medusa")}/app`);
    expect(response.status()).toBe(200);
  });

  test("P5-MED-HDR-001 the expected response headers are present or recorded as a deployment finding", async ({
    request,
    run,
  }, testInfo) => {
    const app = await request.fetch(`${apiBaseUrl("medusa")}/app`);
    expect(app.status(), "control: the admin app answers").toBe(200);
    const store = await openRunStore(request, run);
    const storeResponse = await storeRequest(request, {
      method: "GET",
      path: "/store/regions",
      publishableKey: store.key.value,
    });

    // Inventory only: each expected header is recorded, not asserted (D-MED-7). A missing header is
    // a deployment finding in the annotation, never a failure of this test.
    const rows: { surface: string; name: string; value: string | undefined }[] = [
      {
        surface: "store",
        name: "x-content-type-options",
        value: storeResponse.headers()["x-content-type-options"],
      },
      {
        surface: "store",
        name: "referrer-policy",
        value: storeResponse.headers()["referrer-policy"],
      },
      { surface: "store", name: "cache-control", value: storeResponse.headers()["cache-control"] },
      {
        surface: "app",
        name: "content-security-policy",
        value: app.headers()["content-security-policy"],
      },
      { surface: "app", name: "x-frame-options", value: app.headers()["x-frame-options"] },
    ];
    const missing = rows
      .filter((row) => row.value === undefined)
      .map((row) => `${row.surface} ${row.name}`);
    testInfo.annotations.push({
      type: "deployment-finding",
      description:
        missing.length === 0
          ? "all expected headers present"
          : `${missing.length} of ${rows.length} expected headers absent: ${missing.join("; ")}`,
    });
  });
});
