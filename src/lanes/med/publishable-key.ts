import type { APIRequestContext } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";
import type { AdminSession } from "./admin-session.ts";

/** A publishable key minted for one run. `value` is a credential: never printed. */
export interface RunKey {
  readonly id: string;
  readonly value: string;
  readonly title: string;
}

/** Pure: the title of a run key is the run prefix, so a leftover key is found by prefix. */
export function runKeyTitle(prefix: string): string {
  return prefix;
}

/**
 * Mints a publishable key under the run prefix through the admin API and links it to the sales channel.
 * POST /admin/api-keys (body title, type "publishable"; ApiKeyType.PUBLISHABLE = "publishable",
 * @medusajs/utils fork ref held by the owner) returns { api_key } (core fork ref held by the owner).
 * POST /admin/api-keys/:id/sales-channels takes { add, remove } (core dist/api/admin/api-keys/[id]/sales-channels).
 */
export async function mintRunPublishableKey(
  api: APIRequestContext,
  admin: AdminSession,
  input: { runPrefix: string; salesChannelId: string },
): Promise<RunKey> {
  const base = apiBaseUrl("medusa");
  const title = runKeyTitle(input.runPrefix);
  const created = await api.fetch(`${base}/admin/api-keys`, {
    method: "POST",
    headers: { authorization: admin.authorization, "content-type": "application/json" },
    data: { title, type: "publishable" },
  });
  if (created.status() !== 200) throw new Error(`mint run key failed: HTTP ${created.status()}`);
  const body = (await created.json()) as { api_key?: { id?: string; token?: string } };
  const id = body.api_key?.id;
  const value = body.api_key?.token;
  if (!id || !value)
    throw new Error("mint run key: response has no key id or token (H2 fallback needed)");

  const linked = await api.fetch(`${base}/admin/api-keys/${id}/sales-channels`, {
    method: "POST",
    headers: { authorization: admin.authorization, "content-type": "application/json" },
    data: { add: [input.salesChannelId] },
  });
  if (linked.status() !== 200) {
    throw new Error(`link run key to sales channel failed: HTTP ${linked.status()}`);
  }
  return { id, value, title };
}

/** Revoke then delete (core fork ref held by the owner; DELETE /admin/api-keys/:id). */
export async function revokeRunPublishableKey(
  api: APIRequestContext,
  admin: AdminSession,
  key: RunKey,
): Promise<void> {
  const base = apiBaseUrl("medusa");
  const headers = { authorization: admin.authorization, "content-type": "application/json" };
  const revoked = await api.fetch(`${base}/admin/api-keys/${key.id}/revoke`, {
    method: "POST",
    headers,
    data: {},
  });
  if (revoked.status() !== 200) throw new Error(`revoke run key failed: HTTP ${revoked.status()}`);
  const deleted = await api.fetch(`${base}/admin/api-keys/${key.id}`, {
    method: "DELETE",
    headers,
  });
  if (deleted.status() !== 200) throw new Error(`delete run key failed: HTTP ${deleted.status()}`);
}
