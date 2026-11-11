import type { APIRequestContext } from "@playwright/test";
import type { RunStore } from "./setup.ts";
import { storeRequest } from "./store-client.ts";

/** The system payment provider the seeded region offers (live probe: payment-providers, D-MED-B8). */
export const SYSTEM_PROVIDER_ID = "pp_system_default";

/** Region country: a Medusa region only accepts addresses in its own countries (live run: "us" in an EUR region). */
async function regionCountryCode(api: APIRequestContext, store: RunStore): Promise<string> {
  const response = await storeRequest(api, {
    method: "GET",
    path: `/store/regions/${store.regionId}?fields=countries.iso_2`,
    publishableKey: store.key.value,
  });
  if (response.status() !== 200) throw new Error(`read region failed: HTTP ${response.status()}`);
  const code = ((await response.json()) as { region?: { countries?: { iso_2?: string }[] } }).region
    ?.countries?.[0]?.iso_2;
  if (!code) throw new Error("ENV: the seeded region lists no countries");
  return code;
}

/** Every step fails with its name and HTTP status only (no response body, no secret). */
async function step(
  api: APIRequestContext,
  store: RunStore,
  name: string,
  method: "GET" | "POST",
  path: `/${string}`,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await storeRequest(api, { method, path, publishableKey: store.key.value, body });
  if (response.status() >= 300) {
    // Medusa's message text only (validation wording); the response body is never logged in full.
    const message =
      ((await response.json().catch(() => ({}))) as { message?: string }).message ?? "";
    throw new Error(
      `checkout step "${name}" failed: HTTP ${response.status()}${message ? ` (${message.slice(0, 160)})` : ""}`,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Everything before the complete call: cart email and addresses, shipping option, shipping method, payment
 * collection and payment session (system provider). Refused or failed steps throw with the step name.
 */
export async function prepareCheckout(
  api: APIRequestContext,
  store: RunStore,
  cartId: string,
  email: string,
): Promise<void> {
  const address = {
    first_name: "P5",
    last_name: "Checkout",
    address_1: "1 Test Street",
    city: "Testville",
    country_code: await regionCountryCode(api, store),
    postal_code: "00000",
  };
  await step(api, store, "cart details", "POST", `/store/carts/${cartId}`, {
    email,
    shipping_address: address,
    billing_address: address,
  });
  const options = (await step(
    api,
    store,
    "shipping options",
    "GET",
    `/store/shipping-options?cart_id=${cartId}`,
  )) as {
    shipping_options?: { id: string }[];
  };
  const optionId = options.shipping_options?.[0]?.id;
  if (!optionId) throw new Error("ENV: no shipping option for the seeded cart");
  await step(api, store, "shipping method", "POST", `/store/carts/${cartId}/shipping-methods`, {
    option_id: optionId,
  });
  const collection = (await step(
    api,
    store,
    "payment collection",
    "POST",
    "/store/payment-collections",
    {
      cart_id: cartId,
    },
  )) as { payment_collection?: { id: string } };
  const collectionId = collection.payment_collection?.id;
  if (!collectionId) throw new Error("checkout: no payment collection id");
  await step(
    api,
    store,
    "payment session",
    "POST",
    `/store/payment-collections/${collectionId}/payment-sessions`,
    {
      provider_id: SYSTEM_PROVIDER_ID,
    },
  );
}

/** The complete call only. Returns the order ID, or throws with the response type. */
export async function completeCart(
  api: APIRequestContext,
  store: RunStore,
  cartId: string,
): Promise<string> {
  const completed = (await step(
    api,
    store,
    "complete",
    "POST",
    `/store/carts/${cartId}/complete`,
  )) as {
    type?: string;
    order?: { id?: string };
  };
  const orderId = completed.order?.id;
  if (completed.type !== "order" || !orderId)
    throw new Error(
      `checkout: cart did not complete into an order (type ${completed.type ?? "unknown"})`,
    );
  return orderId;
}

/** Prepares and completes one cart. Returns the order ID. */
export async function placeOrder(
  api: APIRequestContext,
  store: RunStore,
  cartId: string,
  email: string,
): Promise<string> {
  await prepareCheckout(api, store, cartId, email);
  return completeCart(api, store, cartId);
}
