// P5-MED-NEW-MED-6 (med plan 3c.19, proposed). Stock is never oversold by parallel checkouts.
// Cart adds check availability and do not reserve (dist/cart/steps/confirm-inventory.js); the reservation is
// taken when the cart completes, so the oracle counts orders placed against the stock level.
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { createStockedVariant, type StockedVariant } from "../../../src/lanes/med/stock.ts";
import { createGuestCart, openRunStore, type RunStore } from "../../../src/lanes/med/setup.ts";
import { prepareCheckout } from "../../../src/lanes/med/checkout.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";

const STOCK = 1;

async function currencyOf(api: APIRequestContext, store: RunStore): Promise<string> {
  const response = await storeRequest(api, {
    method: "GET",
    path: `/store/regions/${store.regionId}?fields=currency_code`,
    publishableKey: store.key.value,
  });
  const code = ((await response.json()) as { region?: { currency_code?: string } }).region
    ?.currency_code;
  if (!code) throw new Error("ENV: region has no currency");
  return code;
}

async function addOne(
  api: APIRequestContext,
  store: RunStore,
  cartId: string,
  variantId: string,
): Promise<number> {
  const response = await storeRequest(api, {
    method: "POST",
    path: `/store/carts/${cartId}/line-items`,
    publishableKey: store.key.value,
    body: { variant_id: variantId, quantity: 1 },
  });
  return response.status();
}

async function stockedFixture(
  api: APIRequestContext,
  store: RunStore,
  run: Parameters<typeof createStockedVariant>[2],
  label: string,
): Promise<StockedVariant> {
  return createStockedVariant(api, store.admin, run, {
    salesChannelId: store.salesChannelId,
    currencyCode: await currencyOf(api, store),
    quantity: STOCK,
    label,
  });
}

test.describe("P5-MED-NEW-MED-6", () => {
  test("NEW-MED-6 control: one add within stock succeeds", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const fixture = await stockedFixture(request, store, run, "control");
    const cartId = await createGuestCart(request, store);
    expect(
      await addOne(request, store, cartId, fixture.variantId),
      "control: one unit within stock",
    ).toBe(200);
  });

  test("NEW-MED-6 parallel adds never exceed stock", async ({ request, run }, testInfo) => {
    const store = await openRunStore(request, run);
    const fixture = await stockedFixture(request, store, run, "race");
    const parallel = BUDGETS.MED_RACE_PARALLEL_N.value;
    const carts = await Promise.all(
      Array.from({ length: parallel }, () => createGuestCart(request, store)),
    );
    const addStatuses = await Promise.all(
      carts.map((cartId) => addOne(request, store, cartId, fixture.variantId)),
    );
    expect(
      addStatuses.every((status) => status < 500),
      "no server error on parallel adds",
    ).toBe(true);

    // Each cart that took a unit is prepared, then all are completed in parallel. Orders placed are the
    // checkout-time oversell measure: the reservation is taken at completion.
    const holding = carts.filter((_cartId, index) => addStatuses[index] === 200);
    for (const cartId of holding)
      await prepareCheckout(request, store, cartId, `${run.prefix}-oversell@example.test`);
    const completions = await Promise.all(
      holding.map(async (cartId) => {
        const response = await storeRequest(request, {
          method: "POST",
          path: `/store/carts/${cartId}/complete`,
          publishableKey: store.key.value,
        });
        const body = (await response.json().catch(() => ({}))) as { type?: string };
        return { status: response.status(), type: body.type };
      }),
    );
    const orders = completions.filter((completion) => completion.type === "order").length;
    testInfo.annotations.push({
      type: "observation",
      description: `stock=${STOCK}; parallel=${parallel}; add statuses ${addStatuses.join(",")}; orders placed ${orders}`,
    });
    expect(
      completions.every((completion) => completion.status < 500),
      "no server error on parallel completes",
    ).toBe(true);
    expect(
      orders,
      `PRODUCT BUG (SUSPECTED) if more orders than stock (${STOCK}) were placed`,
    ).toBeLessThanOrEqual(STOCK);
  });
});
