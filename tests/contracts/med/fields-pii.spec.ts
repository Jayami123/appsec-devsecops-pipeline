// P5-MED-FIELD-001 (med plan 3c.5, D-MED-8). Order-by-ID is anonymous by source design (fact 13); its fields are recorded.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { PII_FIELDS } from "../../../src/lanes/med/fixtures.ts";
import { createGuestCart, openRunStore } from "../../../src/lanes/med/setup.ts";
import { placeOrder } from "../../../src/lanes/med/checkout.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import type { APIRequestContext } from "@playwright/test";
import type { RunStore } from "../../../src/lanes/med/setup.ts";

/** A guest order placed through the store (system provider). Returns its ID. */
async function guestOrder(
  request: APIRequestContext,
  store: RunStore,
  prefix: string,
  label: string,
): Promise<string> {
  const cartId = await createGuestCart(request, store);
  const added = await storeRequest(request, {
    method: "POST",
    path: `/store/carts/${cartId}/line-items`,
    publishableKey: store.key.value,
    body: { variant_id: await firstVariant(request, store), quantity: 1 },
  });
  expect(added.status(), "setup: add a line to the guest cart").toBe(200);
  return placeOrder(request, store, cartId, `${prefix}-${label}@example.test`);
}

test.describe("P5-MED-FIELD-001", () => {
  test("P5-MED-FIELD-001 control: allowed order fields are returned without authentication", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const orderId = await guestOrder(request, store, run.prefix, "field001a");
    // Anonymous = no customer login. Store routes still require the publishable key header (Medusa v2).
    const response = await request.fetch(`${apiBaseUrl("medusa")}/store/orders/${orderId}`, {
      headers: { "x-publishable-api-key": store.key.value },
    });
    expect(response.status(), "control: anonymous order read by id").toBe(200);
    const order = ((await response.json()) as { order?: { id?: string } }).order;
    expect(order?.id, "control: the order id is returned").toBe(orderId);
  });

  test("P5-MED-FIELD-001 PII fields on the unauthenticated order route are recorded against the PII list", async ({
    request,
    run,
  }, testInfo) => {
    const store = await openRunStore(request, run);
    const orderId = await guestOrder(request, store, run.prefix, "field001b");
    const response = await request.fetch(`${apiBaseUrl("medusa")}/store/orders/${orderId}`, {
      headers: { "x-publishable-api-key": store.key.value },
    });
    expect(response.status(), "the route answers anonymously").toBe(200);
    const order = ((await response.json()) as { order?: Record<string, unknown> }).order ?? {};
    const returnedPii = PII_FIELDS.filter((field) => {
      const [top, nested] = field.replace(/\.\*$/, "").split(".");
      if (nested === undefined) return top !== undefined && top in order;
      const parent = order[top ?? ""];
      return parent !== null && typeof parent === "object" && (nested === "*" || nested in parent);
    });
    // Design verdict (fact 13, source comment at fork ref held by the owner): the order ID is the
    // authentication mechanism. PII keys returned here are recorded for the owner, not asserted as a defect.
    testInfo.annotations.push({
      type: "design-verdict",
      description: `anonymous order-by-id default fields carry PII keys: ${returnedPii.join(", ") || "none"} (D-MED-8)`,
    });
  });
});

async function firstVariant(
  request: APIRequestContext,
  store: { key: { value: string }; regionId: string },
): Promise<string> {
  const products = await storeRequest(request, {
    method: "GET",
    path: `/store/products?region_id=${store.regionId}&limit=10`,
    publishableKey: store.key.value,
  });
  const body = (await products.json()) as { products?: { variants?: { id: string }[] }[] };
  const id = (body.products ?? []).flatMap((product) => product.variants ?? [])[0]?.id;
  if (!id) throw new Error("ENV: no catalog variant in the seeded region");
  return id;
}
