// API tokens for the v2 download route (D-DOC-B52). The download route authenticates with `Authorization: <token>`
// only (fork ref held by the owner), not with the session. A token is created through the
// product (tRPC apiToken.create, fork ref held by the owner) and revoked in cleanup
// (apiToken.delete: id and teamId, fork ref held by the owner). The token value is held in memory only.
import type { APIRequestContext } from "@playwright/test";

export interface MintedToken {
  readonly id: number;
  readonly token: string;
}

/** The created token from a tRPC apiToken.create body (result.data.json: id and token). Throws on any other shape. */
export function mintedTokenFrom(body: unknown): MintedToken {
  const result = (
    body as { result?: { data?: { json?: { id?: unknown; token?: unknown } } } } | null
  )?.result?.data?.json;
  if (typeof result?.id !== "number" || typeof result.token !== "string") {
    throw new Error("TEST BUG: apiToken.create body has no id and token");
  }
  return { id: result.id, token: result.token };
}

/** Creates a token for the actor's personal team. A refusal throws with the status only. */
export async function mintApiToken(
  request: APIRequestContext,
  baseUrl: string,
  teamId: number,
  name: string,
): Promise<MintedToken> {
  const res = await request.post(`${baseUrl}/api/trpc/apiToken.create`, {
    data: { json: { teamId, tokenName: name, expirationDate: null } },
  });
  if (!res.ok()) throw new Error(`apiToken.create returned ${res.status()}`);
  return mintedTokenFrom(await res.json());
}

/** Revokes a token by id. A refusal throws with the status only. */
export async function revokeApiToken(
  request: APIRequestContext,
  baseUrl: string,
  teamId: number,
  id: number,
): Promise<void> {
  const res = await request.post(`${baseUrl}/api/trpc/apiToken.delete`, {
    data: { json: { id, teamId } },
  });
  if (!res.ok()) throw new Error(`apiToken.delete returned ${res.status()}`);
}
