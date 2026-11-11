import type { APIRequestContext } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";
import type { AdminSession } from "./admin-session.ts";
import type { RunScope } from "./run-fixture.ts";

/** A run-prefixed product with one managed variant and a known stock level at one location. */
export interface StockedVariant {
  readonly productId: string;
  readonly variantId: string;
  readonly inventoryItemId: string;
  readonly locationId: string;
}

async function adminCall(
  api: APIRequestContext,
  admin: AdminSession,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await api.fetch(`${apiBaseUrl("medusa")}${path}`, {
    method,
    headers: { authorization: admin.authorization, "content-type": "application/json" },
    data: body,
  });
  if (response.status() >= 300) {
    // Medusa's validation wording only; the body is never logged in full.
    const message =
      ((await response.json().catch(() => ({}))) as { message?: string }).message ?? "";
    throw new Error(
      `stock fixture ${method} ${path} failed: HTTP ${response.status()}${message ? ` (${message.slice(0, 200)})` : ""}`,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Creates a product with one managed variant (manage_inventory true), links it to the sales channel,
 * and sets its stock at the first stock location linked to that channel. The product is retained under the run prefix. Fails closed when the seeded store has no linked location or shipping profile.
 */
export async function createStockedVariant(
  api: APIRequestContext,
  admin: AdminSession,
  run: RunScope,
  input: { salesChannelId: string; currencyCode: string; quantity: number; label: string },
): Promise<StockedVariant> {
  const locations = (await adminCall(
    api,
    admin,
    "GET",
    "/admin/stock-locations?limit=50&fields=id,name,+sales_channels.id",
  )) as {
    stock_locations?: { id: string; sales_channels?: { id: string }[] }[];
  };
  const location = (locations.stock_locations ?? []).find((loc) =>
    (loc.sales_channels ?? []).some((sc) => sc.id === input.salesChannelId),
  );
  if (!location) throw new Error("ENV: no stock location is linked to the sales channel");

  const profiles = (await adminCall(api, admin, "GET", "/admin/shipping-profiles?limit=5")) as {
    shipping_profiles?: { id: string }[];
  };
  const shippingProfileId = profiles.shipping_profiles?.[0]?.id;
  if (!shippingProfileId) throw new Error("ENV: no shipping profile in the seeded store");

  const created = (await adminCall(api, admin, "POST", "/admin/products", {
    title: `${run.prefix} stock ${input.label}`,
    status: "published",
    sales_channels: [{ id: input.salesChannelId }],
    shipping_profile_id: shippingProfileId,
    options: [{ title: "Fixture", values: ["stock"] }],
    variants: [
      {
        title: "stock fixture",
        manage_inventory: true,
        options: { Fixture: "stock" },
        prices: [{ currency_code: input.currencyCode, amount: 1000 }],
      },
    ],
  })) as { product?: { id?: string; variants?: { id?: string }[] } };
  const productId = created.product?.id;
  if (!productId) throw new Error("stock fixture: no product id in the create response");
  // Retained under the run prefix, not deleted: placed orders hold reservations on the inventory item, and
  // Medusa refuses the delete (HTTP 400 "since they have reservations"). The CI stack is ephemeral (D-MED-B39).

  const variant = (await adminCall(
    api,
    admin,
    "GET",
    `/admin/products/${productId}?fields=id,+variants.id,+variants.inventory_items.inventory_item_id`,
  )) as {
    product?: { variants?: { id?: string; inventory_items?: { inventory_item_id?: string }[] }[] };
  };
  const variantEntry = variant.product?.variants?.[0];
  const variantId = variantEntry?.id;
  const inventoryItemId = variantEntry?.inventory_items?.[0]?.inventory_item_id;
  if (!variantId || !inventoryItemId)
    throw new Error("stock fixture: no variant or inventory item");

  await adminCall(api, admin, "POST", `/admin/inventory-items/${inventoryItemId}/location-levels`, {
    location_id: location.id,
    stocked_quantity: input.quantity,
  });
  return { productId, variantId, inventoryItemId, locationId: location.id };
}
