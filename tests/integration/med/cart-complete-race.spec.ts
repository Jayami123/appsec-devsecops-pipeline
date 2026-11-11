// P5-MED-NEW-MED-2 (med plan 3c.15, proposed). Parallel completes of one cart create exactly one order.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { createGuestCart, openRunStore } from "../../../src/lanes/med/setup.ts";
import { prepareCheckout, placeOrder } from "../../../src/lanes/med/checkout.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";
import type { APIRequestContext } from "@playwright/test";
import type { RunStore } from "../../../src/lanes/med/setup.ts";

async function cartWithLine(api: APIRequestContext, store: RunStore): Promise<string> {
  const products = await storeRequest(api, {
    method: "GET",
    path: `/store/products?region_id=${store.regionId}&limit=10`,
    publishableKey: store.key.value,
  });
  const body = (await products.json()) as { products?: { variants?: { id: string }[] }[] };
  const variantId = (body.products ?? []).flatMap((product) => product.variants ?? [])[0]?.id;
  if (!variantId) throw new Error("ENV: no catalog variant in the seeded region");
  const cartId = await createGuestCart(api, store);
  const added = await storeRequest(api, {
    method: "POST",
    path: `/store/carts/${cartId}/line-items`,
    publishableKey: store.key.value,
    body: { variant_id: variantId, quantity: 1 },
  });
  if (added.status() !== 200) throw new Error(`add line failed: HTTP ${added.status()}`);
  return cartId;
}

test.describe("P5-MED-NEW-MED-2", () => {
  test("NEW-MED-2 control: a single complete creates one order", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const cartId = await cartWithLine(request, store);
    const orderId = await placeOrder(request, store, cartId, `${run.prefix}-race2c@example.test`);
    expect(orderId, "control: one order").toBeTruthy();
  });

  test("NEW-MED-2 two parallel completes create exactly one order and one capture", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const cartId = await cartWithLine(request, store);
    await prepareCheckout(request, store, cartId, `${run.prefix}-race2n@example.test`);
    const parallel = BUDGETS.MED_RACE_PARALLEL_N.value;
    const attempts = await Promise.all(
      Array.from({ length: parallel }, async () => {
        const response = await storeRequest(request, {
          method: "POST",
          path: `/store/carts/${cartId}/complete`,
          publishableKey: store.key.value,
        });
        const body = (await response.json().catch(() => ({}))) as {
          type?: string;
          order?: { id?: string };
        };
        return { status: response.status(), type: body.type, orderId: body.order?.id };
      }),
    );
    const orderIds = new Set(
      attempts.filter((attempt) => attempt.type === "order").map((attempt) => attempt.orderId),
    );
    expect(
      attempts.some((attempt) => attempt.status >= 500),
      "no server error on parallel completes",
    ).toBe(false);
    expect(
      orderIds.size,
      "PRODUCT BUG (SUSPECTED) if parallel completes create more than one order",
    ).toBe(1);
  });
});
