// Throwaway actors for the doc lane. Every account is created through the product's own routes under the
// run prefix (doc plan 6.1; AGENTS.md). Never a seed user. Credentials are generated in memory, never printed.
import { expect, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { RUN_PREFIX_PATTERN } from "../../kit/run/prefix.ts";
import { latestMessageBodyFor, extractFirstLink } from "./inbucket.ts";

export type ActorLabel =
  "owner" | "other" | "member" | "recipient-a" | "recipient-b" | "org-b-member" | "outsider";

export interface ThrowawayActor {
  readonly label: ActorLabel;
  readonly email: string; // `${runPrefix}-${label}-${randomHex}@p5.test`
  readonly password: string; // generated; never printed, logged or committed
}

export interface LoginSession {
  readonly email: string; // the address only; the session cookie stays in the APIRequestContext jar
}

export class NotThrowawayError extends Error {
  override readonly name = "NotThrowawayError";
}

/** The sign-up route returns this status for a created account (fork ref held by the owner). */
const SIGNUP_CREATED = 201;
const SIGNIN_CREATED = 201;

export function throwawayActor(
  runPrefix: string,
  label: ActorLabel,
  randomHex: string,
): ThrowawayActor {
  if (!RUN_PREFIX_PATTERN.test(runPrefix))
    throw new NotThrowawayError("run prefix is not p5-qa-shaped");
  if (!/^[0-9a-f]{8}$/.test(randomHex))
    throw new NotThrowawayError("randomHex must be 8 hex chars");
  return {
    label,
    email: `${runPrefix}-${label}-${randomHex}@p5.test`,
    password: `Aa1!${randomBytes(24).toString("base64url")}`,
  };
}

/**
 * Sign up (fork ref held by the owner), read the verification link from the harness mail catcher (D-DOC-B8), then
 * verify through POST /verify-email (fork ref held by the owner). A 429 is the sign-up limiter (fork ref held by the owner,
 * 3 per 3 hours per IP), an ENV block, and is never retried.
 */
export async function createThrowawayAccount(
  request: APIRequestContext,
  baseUrl: string,
  actor: ThrowawayActor,
  runPrefix: string,
): Promise<LoginSession> {
  const signup = await request.post(`${baseUrl}/api/auth/email-password/signup`, {
    data: {
      name: `P5 ${actor.label}`,
      email: actor.email,
      password: actor.password,
      signature: null,
    },
  });
  if (signup.status() !== SIGNUP_CREATED) {
    throw new Error(`ENV or PRODUCT: sign-up for ${actor.label} returned ${signup.status()}`);
  }
  let token: string | null = null;
  await expect
    .poll(
      async () => {
        const body = await latestMessageBodyFor(request, actor.email, runPrefix);
        const link = body === null ? null : extractFirstLink(body, "/verify-email/");
        token =
          link === null
            ? null
            : (link.split("/verify-email/")[1] ?? "").replace(/[^A-Za-z0-9_-].*$/, "");
        return token;
      },
      { message: `verification mail for ${actor.label}` },
    )
    .toBeTruthy();
  const verified = await request.post(`${baseUrl}/api/auth/email-password/verify-email`, {
    data: { token },
  });
  if (verified.status() !== 200)
    throw new Error(`verify-email for ${actor.label} returned ${verified.status()}`);
  const state = (await verified.json()) as { state?: string };
  if (state.state !== "VERIFIED")
    throw new Error(`verify-email for ${actor.label} state ${String(state.state)}`);
  return { email: actor.email };
}

/** Sign in (CSRF from GET /csrf, index.ts:40-42; authorize at fork ref held by the owner). One login per actor per group. */
export async function loginThrowaway(
  request: APIRequestContext,
  baseUrl: string,
  actor: ThrowawayActor,
): Promise<LoginSession> {
  const csrf = await request.get(`${baseUrl}/api/auth/csrf`);
  const csrfToken = ((await csrf.json()) as { csrfToken?: string }).csrfToken ?? "";
  const authorized = await request.post(`${baseUrl}/api/auth/email-password/authorize`, {
    data: { email: actor.email, password: actor.password, csrfToken },
  });
  if (authorized.status() !== SIGNIN_CREATED) {
    throw new Error(`authorize for ${actor.label} returned ${authorized.status()}`);
  }
  return { email: actor.email };
}

/** Ends the session through the product (fork ref held by the owner). Called from finally before down. */
export async function logoutThrowaway(request: APIRequestContext, baseUrl: string): Promise<void> {
  const out = await request.post(`${baseUrl}/api/auth/signout`);
  if (out.status() >= 500) throw new Error(`signout returned ${out.status()}`);
}
