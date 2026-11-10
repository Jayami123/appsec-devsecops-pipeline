import type { APIRequestContext } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";
import { openHarnessAdminSession, type AdminSession } from "./admin-session.ts";
import { mintRunPublishableKey, revokeRunPublishableKey, type RunKey } from "./publishable-key.ts";
import type { RunScope } from "./run-fixture.ts";
import { storeRequest } from "./store-client.ts";

/** Per-test store context: a harness admin session, a run-prefixed publishable key and a region. */
export interface RunStore {
  readonly admin: AdminSession;
  readonly key: RunKey;
  readonly salesChannelId: string;
  readonly regionId: string;
}

/**
 * Opens the per-test store context. The key revoke is registered on the run scope (cleanup in finally).
 * Fails closed: no sales channel or no region is a TEST BUG or ENV error, never a silent fallback.
 */
export async function openRunStore(api: APIRequestContext, run: RunScope): Promise<RunStore> {
  const admin = await openHarnessAdminSession();
  const channels = await api.fetch(`${apiBaseUrl("medusa")}/admin/sales-channels?limit=50`, {
    headers: { authorization: admin.authorization },
  });
  if (channels.status() !== 200)
    throw new Error(`list sales channels failed: HTTP ${channels.status()}`);
  const salesChannelId = ((await channels.json()) as { sales_channels?: { id: string }[] })
    .sales_channels?.[0]?.id;
  if (!salesChannelId) throw new Error("ENV: no sales channel in the seeded store");

  const key = await mintRunPublishableKey(api, admin, { runPrefix: run.prefix, salesChannelId });
  run.onCleanup(() => revokeRunPublishableKey(api, admin, key));

  const regions = await storeRequest(api, {
    method: "GET",
    path: "/store/regions",
    publishableKey: key.value,
  });
  if (regions.status() !== 200) throw new Error(`list regions failed: HTTP ${regions.status()}`);
  const regionId = ((await regions.json()) as { regions?: { id: string }[] }).regions?.[0]?.id;
  if (!regionId) throw new Error("ENV: no region in the seeded store");
  return { admin, key, salesChannelId, regionId };
}

/** Creates a guest cart (no customer). Carts have no delete route on the store: they stay under the run prefix. */
export async function createGuestCart(api: APIRequestContext, store: RunStore): Promise<string> {
  const created = await storeRequest(api, {
    method: "POST",
    path: "/store/carts",
    publishableKey: store.key.value,
    body: { region_id: store.regionId },
  });
  if (created.status() !== 200) throw new Error(`create cart failed: HTTP ${created.status()}`);
  const id = ((await created.json()) as { cart?: { id?: string } }).cart?.id;
  if (!id) throw new Error("create cart: no cart id in response");
  return id;
}

/**
 * Reads the cart's customer ID by ID (anonymous: the route the capability document lists). Reads the default
 * field set, which includes customer.id (core dist/api/store/carts/query-config.js, defaultStoreCartFields).
 * A `fields=customer_id` read returned no customer_id key in the live run (D-MED-B21), so it is not used.
 */
export async function readCartCustomerId(
  api: APIRequestContext,
  store: RunStore,
  cartId: string,
): Promise<string | null> {
  const read = await storeRequest(api, {
    method: "GET",
    path: `/store/carts/${cartId}`,
    publishableKey: store.key.value,
  });
  if (read.status() !== 200) throw new Error(`read cart failed: HTTP ${read.status()}`);
  const cart = ((await read.json()) as { cart?: { customer?: { id?: string } | null } }).cart;
  return cart?.customer?.id ?? null;
}

/** Claims a cart for the bearer's customer (POST /store/carts/:id/customer). Returns the raw response status. */
export async function claimCart(
  api: APIRequestContext,
  store: RunStore,
  cartId: string,
  token: string,
): Promise<number> {
  const claimed = await storeRequest(api, {
    method: "POST",
    path: `/store/carts/${cartId}/customer`,
    publishableKey: store.key.value,
    token,
    body: {},
  });
  return claimed.status();
}
