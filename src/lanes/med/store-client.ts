import type { APIRequestContext, APIResponse } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";

export interface StoreCall {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: `/${string}`;
  readonly publishableKey: string; // never printed
  readonly token?: string; // bearer, never printed
  readonly body?: unknown;
  readonly origin?: string;
}

/** Pure: the request headers for a store call. Undefined values are never sent. */
export function storeHeaders(
  call: Pick<StoreCall, "publishableKey" | "token" | "origin">,
): Record<string, string> {
  const headers: Record<string, string> = { "x-publishable-api-key": call.publishableKey };
  if (call.token !== undefined) headers.authorization = `Bearer ${call.token}`;
  if (call.origin !== undefined) headers.origin = call.origin;
  return headers;
}

export async function storeRequest(api: APIRequestContext, call: StoreCall): Promise<APIResponse> {
  return api.fetch(`${apiBaseUrl("medusa")}${call.path}`, {
    method: call.method,
    headers: storeHeaders(call),
    data: call.body,
  });
}
