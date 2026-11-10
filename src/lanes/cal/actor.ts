// Throwaway actor I/O (D-CAL-B30): self-hosted signup, NextAuth credentials login, API key mint and
// revoke through the product's own routes, and a minimal API v2 client. Each actor owns its own
// Playwright request context, so its session cookie never leaves that context.
// Secrets (password, session cookie, API key) are held in memory only and never printed.
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import { assertThrowawayEmail, throwawayEmail, throwawayPassword } from "./login.ts";

export const V2_BOOKINGS_VERSION = "2024-08-13";
export const V2_EVENT_TYPES_VERSION = "2024-06-14";

export interface CalActor {
  readonly label: string;
  readonly email: string;
  readonly username: string;
  readonly userPrefix: string;
  /** Web (3000) context with the session cookie. */
  readonly web: APIRequestContext;
  /** API v2 key `cal_...`, in memory only. */
  readonly apiKey: string;
  readonly keyNote: string;
  /** Revokes the key this actor created, then disposes the context. Users are retained (D-CAL-B20). */
  dispose(): Promise<void>;
}

function trimBase(url: string): string {
  return url.replace(/\/$/, "");
}

/** Self-hosted signup (selfHostedHandler.ts:45 sets emailVerified, so no mail catcher is needed). */
async function signup(
  web: APIRequestContext,
  email: string,
  password: string,
  username: string,
): Promise<void> {
  const res = await web.post("/api/auth/signup", {
    headers: { "content-type": "application/json" },
    data: { email, password, username },
  });
  if (!res.ok()) throw new Error(`SIGNUP_FAILED status ${res.status()}`);
}

/** NextAuth credentials login: csrf token, then the credentials callback. The cookie stays in `web`. */
async function login(web: APIRequestContext, email: string, password: string): Promise<void> {
  const csrf = await web.get("/api/auth/csrf");
  if (!csrf.ok()) throw new Error(`CSRF_FAILED status ${csrf.status()}`);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await web.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password, json: "true" },
  });
  if (!res.ok()) throw new Error(`LOGIN_FAILED status ${res.status()}`);
  const session = await web.get("/api/auth/session");
  const body = (await session.json()) as { user?: unknown };
  if (!body.user) throw new Error("NO_SESSION_AFTER_LOGIN");
}

/** tRPC viewer.apiKeys.create (create.handler.ts:37-53). Returns the raw `cal_...` key once. */
async function mintKey(web: APIRequestContext, note: string): Promise<string> {
  const res = await web.post("/api/trpc/apiKeys/create", {
    headers: { "content-type": "application/json" },
    data: { json: { note, neverExpires: true } },
  });
  if (!res.ok()) throw new Error(`KEY_MINT_FAILED status ${res.status()}`);
  const body = (await res.json()) as { result?: { data?: { json?: unknown } } };
  const key = body.result?.data?.json;
  if (typeof key !== "string" || !key.startsWith("cal_")) throw new Error("KEY_SHAPE_UNEXPECTED");
  return key;
}

/** Revokes every key of this actor whose note is `note` (apiKeys.list then apiKeys.delete). */
async function revokeKeysWithNote(web: APIRequestContext, note: string): Promise<number> {
  const list = await web.get("/api/trpc/apiKeys/list");
  if (!list.ok()) throw new Error(`KEY_LIST_FAILED status ${list.status()}`);
  const body = (await list.json()) as {
    result?: { data?: { json?: Array<{ id: string; note?: string | null }> } };
  };
  const keys = body.result?.data?.json ?? [];
  let revoked = 0;
  for (const key of keys.filter((k) => k.note === note)) {
    const del = await web.post("/api/trpc/apiKeys/delete", {
      headers: { "content-type": "application/json" },
      data: { json: { id: key.id } },
    });
    if (!del.ok()) throw new Error(`KEY_DELETE_FAILED status ${del.status()}`);
    revoked += 1;
  }
  return revoked;
}

/**
 * Creates a throwaway actor: signup, login, one API key. `label` is [a-z0-9-]{1,20} (login.ts).
 * `baseUrl` is the web app (CAL_BASE_URL). The key note is the actor's email, so revoke finds it.
 */
export async function createThrowawayActor(
  baseUrl: string,
  prefix: string,
  label: string,
): Promise<CalActor> {
  const email = throwawayEmail(prefix, label);
  assertThrowawayEmail(email, prefix);
  const password = throwawayPassword();
  const username = `${prefix}-${label}`;
  const web = await pwRequest.newContext({ baseURL: trimBase(baseUrl) });
  try {
    await signup(web, email, password, username);
    await login(web, email, password);
    const keyNote = email;
    const apiKey = await mintKey(web, keyNote);
    return {
      label,
      email,
      username,
      userPrefix: prefix,
      web,
      apiKey,
      keyNote,
      dispose: async () => {
        try {
          await revokeKeysWithNote(web, keyNote);
        } finally {
          await web.dispose();
        }
      },
    };
  } catch (error) {
    await web.dispose();
    throw error;
  }
}

/** Minimal API v2 client: bearer key, cal-api-version header, JSON body. */
export interface V2Response {
  readonly status: number;
  readonly body: unknown;
}

export async function v2(
  api: APIRequestContext,
  apiKey: string | null,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  version: string,
  data?: unknown,
): Promise<V2Response> {
  const headers: Record<string, string> = {
    "cal-api-version": version,
    "content-type": "application/json",
  };
  if (apiKey !== null) headers.authorization = `Bearer ${apiKey}`;
  const res = await api.fetch(path, {
    method,
    headers,
    data: data === undefined ? undefined : JSON.stringify(data),
  });
  let body: unknown = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text.slice(0, 200);
    }
  }
  return { status: res.status(), body };
}

/** Next weekday (Mon-Fri) at 15:00 UTC, at least two days out. ISO string. */
export function nextBookableStartIso(now: Date): string {
  const d = new Date(now.getTime() + 2 * 86_400_000);
  d.setUTCHours(15, 0, 0, 0);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
