// P5-MED-NEW-MED-4 (med plan 3c.17, proposed). A client-supplied unit price is ignored; the catalog price is used.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { createGuestCart, openRunStore } from "../../../src/lanes/med/setup.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";

interface CartItem {
  readonly variant_id?: string;
  readonly unit_price?: number;
}

/** First catalog variant in the seeded region, read through the store catalog route. */
async function firstVariantId(
  api: Parameters<typeof storeRequest>[0],
  key: string,
  regionId: string,
): Promise<string> {
  const response = await storeRequest(api, {
    method: "GET",
    path: `/store/products?region_id=${regionId}&limit=10`,
    publishableKey: key,
  });
  if (response.status() !== 200) throw new Error(`list products failed: HTTP ${response.status()}`);
  const products =
    ((await response.json()) as { products?: { variants?: { id: string }[] }[] }).products ?? [];
  const id = products.flatMap((product) => product.variants ?? []).map((variant) => variant.id)[0];
  if (!id) throw new Error("ENV: no catalog variant in the seeded region");
  return id;
}

async function addLine(
  api: Parameters<typeof storeRequest>[0],
  key: string,
  cartId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; items: CartItem[] }> {
  const response = await storeRequest(api, {
    method: "POST",
    path: `/store/carts/${cartId}/line-items`,
    publishableKey: key,
    body,
  });
  const items =
    ((await response.json().catch(() => ({}))) as { cart?: { items?: CartItem[] } }).cart?.items ??
    [];
  return { status: response.status(), items };
}

test.describe("P5-MED-NEW-MED-4", () => {
  test("NEW-MED-4 control: a catalog add uses the catalog unit price", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const variantId = await firstVariantId(request, store.key.value, store.regionId);
    const cartId = await createGuestCart(request, store);
    const added = await addLine(request, store.key.value, cartId, {
      variant_id: variantId,
      quantity: 1,
    });
    expect(added.status, "catalog add status").toBe(200);
    const line = added.items.find((item) => item.variant_id === variantId);
    expect(line?.unit_price, "catalog unit price is set").toBeGreaterThan(0);
  });

  test("NEW-MED-4 a client unit_price is ignored", async ({ request, run }, testInfo) => {
    const store = await openRunStore(request, run);
    const variantId = await firstVariantId(request, store.key.value, store.regionId);

    // Control fixture (independent cart): the catalog price with no client price.
    const controlCart = await createGuestCart(request, store);
    const control = await addLine(request, store.key.value, controlCart, {
      variant_id: variantId,
      quantity: 1,
    });
    const catalogPrice = control.items.find((item) => item.variant_id === variantId)?.unit_price;
    expect(catalogPrice, "control: catalog price").toBeGreaterThan(0);

    // Negative fixture (its own cart): a client unit_price of 1.
    // Oracle: the schema refuses the unknown field with 4xx (PASS: the client price is not applied), or the
    // add is accepted (200) and the line carries the catalog price. Any 200 with the client price is a defect.
    const tamperCart = await createGuestCart(request, store);
    const tampered = await addLine(request, store.key.value, tamperCart, {
      variant_id: variantId,
      quantity: 1,
      unit_price: 1,
    });
    if (tampered.status === 200) {
      const tamperedPrice = tampered.items.find(
        (item) => item.variant_id === variantId,
      )?.unit_price;
      expect(tamperedPrice, "PRODUCT BUG (SUSPECTED): a client unit_price was applied").toBe(
        catalogPrice,
      );
    } else {
      expect(
        tampered.status,
        "unknown client field refused with a client error",
      ).toBeGreaterThanOrEqual(400);
      expect(tampered.status, "refusal is not a server error").toBeLessThan(500);
      const items = (
        await addLine(request, store.key.value, tamperCart, { variant_id: variantId, quantity: 1 })
      ).items;
      expect(
        items.some((item) => item.unit_price === 1),
        "no line in the tampered cart carries the client price",
      ).toBe(false);
    }
    testInfo.annotations.push({
      type: "observation",
      description: `client unit_price field: HTTP ${tampered.status}`,
    });
  });
});
