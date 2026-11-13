// Documenso OIDC helpers for the two OIDC rows (doc plan; verdicts OIDC-001 and OIDC-002). Lane-local, under the
// owned tests/integration/doc/ path. Not a spec file, so Playwright does not collect it.
//
// The provider is the harness's opt-in overlay (DOCUMENSO_OIDC=1 at `up`; harness v0.5.0,
// src/adapters/documenso-oidc.ts). Its login form takes a username and a JSON claims object, so each login sets
// email_verified. It does not check the client secret or the redirect URI, and it does not enforce single-use codes
// (observed 2026-11-13: a second token exchange of the same code returned 200). No test asserts a provider-side
// rejection; Documenso's own checks are the system under test.
import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";

/** Copied from the harness (src/adapters/documenso-oidc.ts:19-24), not imported: importing its index loads .env (D-DOC-B17). */
export const IDP_ISSUER = "http://127.0.0.1:8081/default";
export const IDP_WELL_KNOWN_URL = `${IDP_ISSUER}/.well-known/openid-configuration`;
export const IDP_CLIENT_ID = "qa-documenso";

/** Documenso routes: packages/auth/server/index.ts:45-48, routes/oauth.ts, routes/callback.ts, routes/session.ts. */
export const OIDC_AUTHORIZE_PATH = "/api/auth/oauth/authorize/oidc";
export const OIDC_CALLBACK_PATH = "/api/auth/callback/oidc";
export const SESSION_PATH = "/api/auth/session";
export const SIGNOUT_PATH = "/api/auth/signout";

export interface IdpClaims {
  readonly sub: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly name: string;
}

/** Claims for one login. The sub and the email carry the run prefix, so nothing collides across runs. */
export function claimsFor(runPrefix: string, tag: string, emailVerified: boolean): IdpClaims {
  const hex = randomBytes(4).toString("hex");
  return {
    sub: `${runPrefix}-${tag}-${hex}`,
    email: `${runPrefix}-${tag}-${hex}@p5.test`,
    email_verified: emailVerified,
    name: `P5 ${tag}`,
  };
}

/** The provider's discovery document status (the setup assertion). */
export async function wellKnownStatus(): Promise<number> {
  const res = await fetch(IDP_WELL_KNOWN_URL);
  await res.text();
  return res.status;
}

/** Starts a sign-in through the product (authorize sets the state and PKCE cookies in the request's jar). */
export function startSignIn(
  request: APIRequestContext,
  web: string,
  redirectPath = "/",
): Promise<APIResponse> {
  return request.post(`${web}${OIDC_AUTHORIZE_PATH}`, { data: { redirectPath } });
}

/** The provider URL the product returned (redirectUrl), read from a successful authorize response. */
export async function redirectUrlOf(started: APIResponse): Promise<string> {
  const body = (await started.json()) as { redirectUrl?: unknown };
  expect(typeof body.redirectUrl, "authorize returns a redirectUrl").toBe("string");
  return body.redirectUrl as string;
}

/**
 * Walks the provider's login form for one authorize URL: GET the form, POST the username and the claims to the
 * same URL (the form has no action), then read the 302 to the callback. The callback carries the code and the
 * state the provider echoes. Returns the full callback URL.
 */
export async function idpLogin(authorizeUrl: string, claims: IdpClaims): Promise<string> {
  const page = await fetch(authorizeUrl, { redirect: "manual" });
  expect(page.status, "provider login form").toBe(200);
  await page.text();
  const form = new URLSearchParams({ username: claims.sub, claims: JSON.stringify(claims) });
  const posted = await fetch(authorizeUrl, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  await posted.text();
  expect(posted.status, "provider login redirects to the callback").toBe(302);
  const location = posted.headers.get("location");
  expect(location, "provider redirect carries a location").not.toBeNull();
  return new URL(location ?? "", authorizeUrl).toString();
}

/** The state value in a callback URL. */
export function stateIn(callbackUrl: string): string {
  return new URL(callbackUrl).searchParams.get("state") ?? "";
}

/** The callback URL with its state replaced (a state that does not match the stored cookie). */
export function withState(callbackUrl: string, state: string): string {
  const url = new URL(callbackUrl);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Email of the signed-in user from the product's session route, or null when no session. */
export async function sessionEmail(
  request: APIRequestContext,
  web: string,
): Promise<string | null> {
  const res = await request.get(`${web}${SESSION_PATH}`);
  expect(res.status(), "session route answers").toBe(200);
  const body = (await res.json()) as { user?: { email?: unknown } | null };
  return typeof body.user?.email === "string" ? body.user.email : null;
}

/** Ends the session through the product (sign-out, POST). Used in cleanup and between the two halves of a row. */
export async function signOut(request: APIRequestContext, web: string): Promise<void> {
  const res = await request.post(`${web}${SIGNOUT_PATH}`);
  if (res.status() >= 500) throw new Error(`signout returned ${res.status()}`);
}

/**
 * Setup check, independent of Documenso: the provider signs in with its own PKCE pair and state, and its ID token
 * carries the email_verified value the login set. Confirms the precondition the unverified-email row relies on.
 * The mock does not check the client secret, so the token exchange sends none.
 */
export async function providerIdTokenClaims(
  claims: IdpClaims,
  redirectUri: string,
): Promise<Record<string, unknown>> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  const authorize = new URL(`${IDP_ISSUER}/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: IDP_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  const callback = new URL(await idpLogin(authorize.toString(), claims));
  expect(callback.searchParams.get("state"), "provider echoes the state").toBe(state);
  const code = callback.searchParams.get("code") ?? "";
  expect(code.length, "provider issues a code").toBeGreaterThan(0);
  const token = await fetch(`${IDP_ISSUER}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: IDP_CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  });
  expect(token.status, "provider token exchange").toBe(200);
  const tokens = (await token.json()) as { id_token?: unknown };
  expect(typeof tokens.id_token, "provider issues an id_token").toBe("string");
  const payload = (tokens.id_token as string).split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** The redirect URI Documenso registers for the provider (packages/auth/server/config.ts:44). */
export function callbackUri(web: string): string {
  return `${web}${OIDC_CALLBACK_PATH}`;
}
