// Documenso OIDC helpers for the OIDC rows (doc plan; verdicts OIDC-001 and OIDC-002). Lane-local, under the owned
// tests/integration/doc/ path. Not a spec file, so Playwright does not collect it.
//
// The provider is the harness's Keycloak 26.5.0 realm (DOCUMENSO_OIDC=1 at `up`; harness v0.5.1,
// src/adapters/documenso-oidc.ts). It publishes scopes_supported and PKCE S256. The client is confidential, so this
// process never exchanges a code: Documenso does that with the per-run secret, which the tests never read. The two seeded
// users come only from documensoOidcTestUsers() (harness README: never upload, print or log the run-state file). The
// harness does not expose the admin credentials, so tests create no realm objects.
import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { documensoOidcTestUsers } from "qa-portfolio-harness";
import { randomBytes } from "node:crypto";

/** Copied from the harness fork ref held by the owner). Not read from the index: the constants are fixed. */
export const IDP_ORIGIN = "http://127.0.0.1:8081";
export const IDP_REALM = "qa";
export const IDP_WELL_KNOWN_URL = `${IDP_ORIGIN}/realms/${IDP_REALM}/.well-known/openid-configuration`;
export const IDP_CLIENT_ID = "qa-documenso";

/** The seeded users' email addresses (harness src/adapters/documenso-oidc.ts:36-39). Usernames and passwords come from the reader. */
export const VERIFIED_EMAIL = "verified@qa.test";
export const UNVERIFIED_EMAIL = "unverified@qa.test";

/** Documenso routes: fork ref held by the owner, fork ref held by the owner, fork ref held by the owner, fork ref held by the owner. */
export const OIDC_AUTHORIZE_PATH = "/api/auth/oauth/authorize/oidc";
export const OIDC_CALLBACK_PATH = "/api/auth/callback/oidc";
export const SESSION_PATH = "/api/auth/session";
export const SIGNOUT_PATH = "/api/auth/signout";
export const SIGNUP_PATH = "/api/auth/email-password/signup";
export const LOCAL_AUTHORIZE_PATH = "/api/auth/email-password/authorize";

/** The seeded users (usernames and passwords, read from the run state, never printed). */
export function seededUsers(): ReturnType<typeof documensoOidcTestUsers> {
  return documensoOidcTestUsers();
}

/** The provider's discovery document and its status (the setup assertion). */
export async function discovery(): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(IDP_WELL_KNOWN_URL);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
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
  expect(typeof body.redirectUrl, "authorize returns a redirect URL").toBe("string");
  return body.redirectUrl as string;
}

/**
 * Walks the provider's login page for one authorize URL with a fresh cookie jar: GET the login form, POST the username
 * and password to the form action (decoded from the page), then read the 302 to the callback. Returns the callback URL
 * with the code and the echoed state. Credentials are sent to the provider only and never appear in an assertion message.
 */
export async function keycloakLogin(
  authorizeUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const jar = new Map<string, string>();
  const absorb = (res: Response): void => {
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
  };
  const cookieHeader = (): string => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  const page = await fetch(authorizeUrl, { redirect: "manual" });
  absorb(page);
  const html = await page.text();
  expect(page.status, "provider login page answers").toBe(200);
  const formTag = /<form\b[^>]*\bid="kc-form-login"[^>]*>/i.exec(html)?.[0] ?? "";
  const action = /\baction="([^"]+)"/i.exec(formTag)?.[1];
  expect(action !== undefined, "provider login form has an action").toBe(true);
  const target = new URL((action ?? "").replace(/&amp;/g, "&"), IDP_ORIGIN);

  const posted = await fetch(target, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ username, password }).toString(),
  });
  absorb(posted);
  await posted.text();
  const location = posted.headers.get("location");
  expect(posted.status, "provider login redirects to the callback").toBe(302);
  expect(location !== null, "provider redirect carries a location").toBe(true);
  return new URL(location ?? "", target).toString();
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

/** Ends the session through the product (sign-out, POST). Used in cleanup and between halves of a row. */
export async function signOut(request: APIRequestContext, web: string): Promise<void> {
  const res = await request.post(`${web}${SIGNOUT_PATH}`);
  if (res.status() >= 500) throw new Error(`signout returned ${res.status()}`);
}

/** The redirect URI Documenso registers with the provider (fork ref held by the owner). */
export function callbackUri(web: string): string {
  return `${web}${OIDC_CALLBACK_PATH}`;
}

/** A local password for a throwaway account. Generated in memory; never printed. */
export function localPassword(): string {
  return `Aa1!${randomBytes(24).toString("base64url")}`;
}

/** Creates a local Documenso account with the given address through the sign-up route (fork ref held by the owner). */
export async function createLocalAccount(
  request: APIRequestContext,
  web: string,
  email: string,
  password: string,
): Promise<number> {
  const res = await request.post(`${web}${SIGNUP_PATH}`, {
    data: { name: "P5 local", email, password, signature: null },
  });
  return res.status();
}

/** The status of a local password sign-in (fork ref held by the owner). Compared before and after a refused OIDC attempt. */
export async function localSignInStatus(
  request: APIRequestContext,
  web: string,
  email: string,
  password: string,
): Promise<number> {
  const csrf = await request.get(`${web}/api/auth/csrf`);
  const token = ((await csrf.json()) as { csrfToken?: string }).csrfToken ?? "";
  const res = await request.post(`${web}${LOCAL_AUTHORIZE_PATH}`, {
    data: { email, password, csrfToken: token },
  });
  return res.status();
}
