// P5-MED-NEW-MED-3 (med plan 3c.16, re-scoped). Design verdict on redemptions of the seeded unlimited code.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { createGuestCart, openRunStore } from "../../../src/lanes/med/setup.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";
import type { RunStore } from "../../../src/lanes/med/setup.ts";
import type { APIRequestContext } from "@playwright/test";

// The seeded code (medusa-seed.ts:161, ensurePromoCode). It is unlimited: no usage_limit (probe 2g).
const SEEDED_CODE = "QA10";

/** A cart with one catalog line, so a percentage promotion has something to discount. */
async function cartWithItem(api: APIRequestContext, store: RunStore): Promise<string> {
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
  if (added.status() !== 200) throw new Error(`add line item failed: HTTP ${added.status()}`);
  return cartId;
}

async function applyCode(
  api: APIRequestContext,
  key: string,
  cartId: string,
): Promise<{ status: number; discount: number }> {
  const response = await storeRequest(api, {
    method: "POST",
    path: `/store/carts/${cartId}/promotions`,
    publishableKey: key,
    body: { promo_codes: [SEEDED_CODE] },
  });
  const cart = ((await response.json().catch(() => ({}))) as { cart?: { discount_total?: number } })
    .cart;
  return { status: response.status(), discount: cart?.discount_total ?? 0 };
}

test.describe("P5-MED-NEW-MED-3", () => {
  test("NEW-MED-3 control: one redemption applies the discount", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const cartId = await cartWithItem(request, store);
    const applied = await applyCode(request, store.key.value, cartId);
    expect(applied.status, "apply the seeded code").toBe(200);
    expect(applied.discount, "one redemption applies a discount").toBeGreaterThan(0);
  });

  test("NEW-MED-3 parallel redemptions of an unlimited code are recorded", async ({
    request,
    run,
  }, testInfo) => {
    const store = await openRunStore(request, run);
    const parallel = BUDGETS.MED_RACE_PARALLEL_N.value;
    const carts = await Promise.all(
      Array.from({ length: parallel }, () => cartWithItem(request, store)),
    );
    const results = await Promise.all(
      carts.map((cartId) => applyCode(request, store.key.value, cartId)),
    );
    // Each parallel redemption must get a definite client or success answer; a 5xx would be a finding.
    expect(
      results.every((result) => result.status < 500),
      "no server error on parallel redemptions",
    ).toBe(true);
    // Design verdict (D-MED-B9 / med plan 3c.16): the count is recorded, not asserted as a defect.
    const applied = results.filter((result) => result.discount > 0).length;
    testInfo.annotations.push({
      type: "design-verdict",
      description: `parallel=${parallel} redemptions of unlimited code ${SEEDED_CODE}: ${applied} applied, statuses ${results
        .map((result) => result.status)
        .join(",")}`,
    });
  });
});
