// OAuth client flow through the product's normal user routes (P-5 probe, D-CAL-B13):
// viewer.oAuth.submitClientForReview (authed, not admin) creates the client as PENDING;
// oAuth.generateAuthCode (authed) issues a PKCE code for the owner's PENDING client
// (OAuthService.ts:96-126 ensureClientIsApprovedOrOwnedPending); /api/auth/oauth/token exchanges it
// (OAuthService.ts:312 same check). Routes: pages/api/trpc/oAuth/*, apps/web/app/api/auth/oauth/token.
import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

export interface OAuthClient {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface Pkce {
  readonly verifier: string;
  readonly challenge: string;
}

export function pkcePair(): Pkce {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function trpcJson(
  web: APIRequestContext,
  path: string,
  json: unknown,
): Promise<{ status: number; data: unknown; text: string }> {
  const res = await web.post(`/api/trpc/${path}`, {
    headers: { "content-type": "application/json" },
    data: { json },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data =
      (JSON.parse(text) as { result?: { data?: { json?: unknown } } }).result?.data?.json ?? null;
  } catch {
    data = null;
  }
  return { status: res.status(), data, text };
}

/** Creates an OAuth client for the logged-in owner (PENDING, usable by its owner). */
export async function submitOwnedClient(
  web: APIRequestContext,
  base: string,
  name: string,
): Promise<OAuthClient> {
  const redirectUri = `${base.replace(/\/$/, "")}/p5-oauth-callback`;
  const res = await trpcJson(web, "oAuth/submitClientForReview", {
    name,
    purpose: "p5 lane probe",
    redirectUri,
    enablePkce: true,
  });
  if (res.status !== 200) throw new Error(`SUBMIT_CLIENT_FAILED status ${res.status}`);
  const data = res.data as { clientId?: string; clientSecret?: string } | null;
  if (!data?.clientId || !data.clientSecret)
    throw new Error(`SUBMIT_CLIENT_SHAPE: ${res.text.slice(0, 240)}`);
  return { clientId: data.clientId, clientSecret: data.clientSecret, redirectUri };
}

/** Issues a PKCE authorization code for the owned client. */
export async function issueCode(
  web: APIRequestContext,
  client: OAuthClient,
  challenge: string,
): Promise<string> {
  const res = await trpcJson(web, "oAuth/generateAuthCode", {
    clientId: client.clientId,
    redirectUri: client.redirectUri,
    scopes: [],
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
  });
  if (res.status !== 200) throw new Error(`GENERATE_CODE_FAILED status ${res.status}`);
  const code = (res.data as { authorizationCode?: string } | null)?.authorizationCode;
  if (!code) throw new Error(`GENERATE_CODE_SHAPE: ${res.text.slice(0, 240)}`);
  return code;
}

/** Exchanges a code at the token route (form body). Returns status and whether an access token came back. */
export async function exchange(
  web: APIRequestContext,
  client: OAuthClient,
  code: string,
  verifier: string,
): Promise<{ status: number; accessToken: boolean }> {
  const res = await web.post("/api/auth/oauth/token", {
    form: {
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: client.redirectUri,
      code_verifier: verifier,
    },
  });
  let accessToken: boolean;
  try {
    const body = (await res.json()) as { access_token?: unknown };
    accessToken = typeof body.access_token === "string" && body.access_token.length > 0;
  } catch {
    accessToken = false;
  }
  return { status: res.status(), accessToken };
}
