import { randomBytes } from "node:crypto";
import { currentRunPrefix } from "../../kit/run/prefix.ts";
import { TWENTY_DEFAULT_ADMIN_EMAIL, TWENTY_DEV_SEED_PASSWORD } from "qa-portfolio-harness";
import { gql } from "./gql.ts";

export interface TwSession {
  readonly accessToken: string; // never logged, never written to an artefact
  readonly workspaceId: string;
}

/** Throwaway actors only. Refuses any email that does not carry the run prefix. */
export function assertThrowawayEmail(email: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!email.startsWith(currentRunPrefix(env))) {
    throw new Error("NOT_THROWAWAY");
  }
}

/** A throwaway email for one actor: `<run prefix>-<label>@example.test`. */
export function throwawayEmail(prefix: string, label: string): string {
  return `${prefix}-${label}@example.test`;
}

/** A per-run password for a throwaway actor. Generated in memory, never logged or stored. */
export function throwawayPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Sign-in through the two product mutations (packages/twenty-server auth.resolver.ts:220-223
 * getLoginTokenFromCredentials, then :758-761 getAuthTokensFromLoginToken). Captcha is disabled by
 * default (captcha-driver.factory.ts:28-30), and the harness sets no CAPTCHA_DRIVER.
 */
export async function loginThrowaway(input: {
  baseUrl: string;
  email: string;
  password: string;
}): Promise<TwSession> {
  assertThrowawayEmail(input.email);
  return signInWithPassword(input);
}

async function signInWithPassword(input: {
  baseUrl: string;
  email: string;
  password: string;
}): Promise<TwSession> {
  const origin = new URL(input.baseUrl).origin;
  const login = await gql<{ getLoginTokenFromCredentials: { loginToken: { token: string } } }>({
    baseUrl: input.baseUrl,
    operation: "getLoginTokenFromCredentials",
    endpoint: "metadata",
    query: `mutation Login($email: String!, $password: String!, $origin: String!) {
      getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) { loginToken { token } }
    }`,
    variables: { email: input.email, password: input.password, origin },
  });
  const tokens = await gql<{
    getAuthTokensFromLoginToken: { tokens: { accessOrWorkspaceAgnosticToken: { token: string } } };
  }>({
    baseUrl: input.baseUrl,
    operation: "getAuthTokensFromLoginToken",
    endpoint: "metadata",
    query: `mutation Exchange($loginToken: String!, $origin: String!) {
      getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
        tokens { accessOrWorkspaceAgnosticToken { token } }
      }
    }`,
    variables: { loginToken: login.getLoginTokenFromCredentials.loginToken.token, origin },
  });
  const accessToken =
    tokens.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
  const current = await gql<{ currentWorkspace: { id: string } }>({
    baseUrl: input.baseUrl,
    operation: "currentWorkspace",
    endpoint: "metadata",
    query: `query { currentWorkspace { id } }`,
    bearer: accessToken,
  });
  return { accessToken, workspaceId: current.currentWorkspace.id };
}

/**
 * The harness dev-seed workspace admin, used only as setup (invite and role changes, D-TW-B5). It is
 * never an actor under test. The credentials come from the harness export and are never logged.
 */
export async function adminSetupSession(baseUrl: string): Promise<TwSession> {
  return signInWithPassword({
    baseUrl,
    email: TWENTY_DEFAULT_ADMIN_EMAIL,
    password: TWENTY_DEV_SEED_PASSWORD,
  });
}

const LIMIT_MESSAGE = /too many|rate limit|ratelimit|locked|throttl|too_many|rate_limit|blocked/i;

/**
 * One password attempt (getLoginTokenFromCredentials). Returns the HTTP status and whether the reply
 * is a limit (HTTP 429, or a GraphQL error whose message names a limit). Never returns the body.
 */
export async function attemptLogin(input: {
  readonly baseUrl: string;
  readonly email: string;
  readonly password: string;
}): Promise<{ readonly status: number; readonly limited: boolean; readonly ok: boolean }> {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `mutation L($email: String!, $password: String!, $origin: String!) {
        getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) { loginToken { token } }
      }`,
      variables: {
        email: input.email,
        password: input.password,
        origin: new URL(input.baseUrl).origin,
      },
    }),
  });
  const text = await response.text();
  const limited = response.status === 429 || LIMIT_MESSAGE.test(text);
  const ok = response.ok && !text.includes('"errors"');
  return { status: response.status, limited, ok };
}
