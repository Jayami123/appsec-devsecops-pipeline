// P5-MED-NEW-MED-1 (med plan 3c.14, proposed). The order list is scoped to the calling customer.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { createThrowawayCustomer, deleteThrowawayCustomer } from "../../../src/lanes/med/auth.ts";
import { claimCart, createGuestCart, openRunStore } from "../../../src/lanes/med/setup.ts";
import { placeOrder } from "../../../src/lanes/med/checkout.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import type { APIRequestContext } from "@playwright/test";
import type { RunStore } from "../../../src/lanes/med/setup.ts";

async function listOrderIds(api: APIRequestContext, token: string, key: string): Promise<string[]> {
  const response = await api.fetch(`${apiBaseUrl("medusa")}/store/orders`, {
    headers: { "x-publishable-api-key": key, authorization: `Bearer ${token}` },
  });
  if (response.status() !== 200) throw new Error(`list orders failed: HTTP ${response.status()}`);
  return (((await response.json()) as { orders?: { id: string }[] }).orders ?? []).map(
    (order) => order.id,
  );
}

async function claimedOrder(
  api: APIRequestContext,
  store: RunStore,
  token: string,
  customerEmail: string,
  prefix: string,
): Promise<string> {
  const cartId = await createGuestCart(api, store);
  const claim = await claimCart(api, store, cartId, token);
  if (claim !== 200) throw new Error(`claim cart for order failed: HTTP ${claim}`);
  await storeRequest(api, {
    method: "POST",
    path: `/store/carts/${cartId}/line-items`,
    publishableKey: store.key.value,
    body: { variant_id: await firstVariant(api, store), quantity: 1 },
  });
  return placeOrder(api, store, cartId, `${prefix}-${customerEmail}@example.test`);
}

test.describe("P5-MED-NEW-MED-1", () => {
  test("NEW-MED-1 control: the owner lists her own order", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const a = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "idor1a",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, a.customerId));
    const orderId = await claimedOrder(request, store, a.token, "idor1a", run.prefix);
    expect(await listOrderIds(request, a.token, store.key.value), "owner sees her order").toContain(
      orderId,
    );
  });

  test("NEW-MED-1 another customer's list does not contain the order", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const a = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "idor1a",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, a.customerId));
    const b = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "idor1b",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, b.customerId));
    const orderId = await claimedOrder(request, store, a.token, "idor1a", run.prefix);
    const before = await listOrderIds(request, a.token, store.key.value);
    expect(before, "before: A's order is in A's list").toContain(orderId);
    const bList = await listOrderIds(request, b.token, store.key.value);
    expect(bList, "PRODUCT BUG (SUSPECTED) if B's list contains A's order").not.toContain(orderId);
  });
});

async function firstVariant(api: APIRequestContext, store: RunStore): Promise<string> {
  const products = await storeRequest(api, {
    method: "GET",
    path: `/store/products?region_id=${store.regionId}&limit=10`,
    publishableKey: store.key.value,
  });
  const body = (await products.json()) as { products?: { variants?: { id: string }[] }[] };
  const id = (body.products ?? []).flatMap((product) => product.variants ?? [])[0]?.id;
  if (!id) throw new Error("ENV: no catalog variant in the seeded region");
  return id;
}
