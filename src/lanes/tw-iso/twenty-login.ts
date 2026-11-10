// Throwaway actor for the tw-iso rows (tw-iso.md section 10). Normal product routes only:
//   /metadata: signIn (admin, as inviter), getAuthTokensFromLoginToken, signUp
//   /graphql : sendInvitations (admin), createApiKey, generateApiKeyToken, revokeApiKey (actor)
// The dev-seed admin is used ONLY as the inviter, because single-workspace sign-up is refused for an
// email with no provisioned destination (sign-in-up.service.ts:463-482). Never a seed user as an actor.
// Credentials, tokens and key values are generated or read in memory and never printed or stored.
import { randomBytes } from "node:crypto";
import { TWENTY_DEFAULT_ADMIN_EMAIL, TWENTY_DEV_SEED_PASSWORD } from "qa-portfolio-harness";
import { apiBaseUrl } from "../../kit/env.ts";
import { RUN_PREFIX_PATTERN, currentRunPrefix } from "../../kit/run/prefix.ts";

export interface ThrowawayActor {
  /** Throwaway email; always starts with the run prefix. */
  readonly email: string;
  /** Workspace the actor belongs to, as returned by the normal route. */
  readonly workspaceId: string;
  /** Headers for the actor's credential (its API key, or its own login token if key minting was refused). Never logged. */
  authHeaders(): Record<string, string>;
  /** Revokes every key this actor minted, then verifies a refusal. Idempotent. */
  revokeAll(): Promise<{ revoked: number }>;
}

export interface CreateActorOptions {
  /** From currentRunPrefix() in src/kit/run/prefix.ts. Must match RUN_PREFIX_PATTERN. */
  runPrefix?: string;
  /** From the harness readiness output. Never a literal host. */
  baseUrl?: string;
  /** When true, mint an API key through the normal login exchange. */
  mintApiKey: boolean;
  /** Distinct per call within a run. */
  index?: number;
}

const SIGN_IN = `mutation SignIn($email: String!, $password: String!) {
  signIn(email: $email, password: $password) {
    availableWorkspaces { availableWorkspacesForSignIn { id loginToken workspaceUrls { subdomainUrl customUrl } } }
  }
}`;

const SIGN_UP = `mutation SignUp($email: String!, $password: String!) {
  signUp(email: $email, password: $password) {
    availableWorkspaces {
      availableWorkspacesForSignIn { id loginToken workspaceUrls { subdomainUrl customUrl } }
      availableWorkspacesForSignUp { id loginToken workspaceUrls { subdomainUrl customUrl } }
    }
  }
}`;

const EXCHANGE = `mutation GetAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {
  getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
    tokens { accessOrWorkspaceAgnosticToken { token } }
  }
}`;

const SEND_INVITATIONS = `mutation SendInvitations($emails: [String!]!) {
  sendInvitations(emails: $emails) { success errors }
}`;

const CREATE_API_KEY = `mutation CreateApiKey($input: CreateApiKeyInput!) {
  createApiKey(input: $input) { id }
}`;

const GENERATE_API_KEY_TOKEN = `mutation GenerateApiKeyToken($apiKeyId: UUID!, $expiresAt: String!) {
  generateApiKeyToken(apiKeyId: $apiKeyId, expiresAt: $expiresAt) { token }
}`;

const REVOKE_API_KEY = `mutation RevokeApiKey($input: RevokeApiKeyInput!) {
  revokeApiKey(input: $input) { id }
}`;

const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

type Json = Record<string, unknown>;

interface Reply {
  readonly status: number;
  readonly body: Json;
}

/** Pure: the throwaway email for one actor in one run. */
export function throwawayEmail(prefix: string, index: number): string {
  if (!RUN_PREFIX_PATTERN.test(prefix)) {
    throw new Error("TEST BUG: run prefix does not match RUN_PREFIX_PATTERN");
  }
  return `${prefix}-iso-${index}@example.test`;
}

async function call(
  url: string,
  token: string | undefined,
  query: string,
  variables: Json,
): Promise<Reply> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  let body: Json;
  try {
    body = JSON.parse(text) as Json;
  } catch {
    body = {};
  }
  return { status: response.status, body };
}

/** Returns data[op] or throws. The error text is the product's message name only, never a body or a token. */
function dataOf(op: string, reply: Reply): Json {
  const errors = reply.body.errors;
  const data = reply.body.data as Json | null | undefined;
  if (reply.status !== 200 || !data || (Array.isArray(errors) && errors.length > 0)) {
    const first = Array.isArray(errors)
      ? (errors[0] as { message?: unknown } | undefined)
      : undefined;
    const message = typeof first?.message === "string" ? first.message.slice(0, 120) : "no message";
    throw new Error(`${op} refused: HTTP ${reply.status} (${message})`);
  }
  const value = data[op];
  if (value === undefined || value === null) throw new Error(`${op} returned no data`);
  return value as Json;
}

function listOf(value: unknown): Json[] {
  return Array.isArray(value) ? (value as Json[]) : [];
}

function loginTokenOf(workspaces: unknown): { id: string; loginToken: string } {
  const list = listOf(workspaces);
  const first = list.find((w) => typeof w.loginToken === "string" && typeof w.id === "string");
  if (!first) throw new Error("no workspace login token in the normal login reply");
  return { id: first.id as string, loginToken: first.loginToken as string };
}

async function exchange(metadataUrl: string, loginToken: string, origin: string): Promise<string> {
  const reply = await call(metadataUrl, undefined, EXCHANGE, { loginToken, origin });
  const data = dataOf("getAuthTokensFromLoginToken", reply);
  const token = (
    (data.tokens as Json | undefined)?.accessOrWorkspaceAgnosticToken as Json | undefined
  )?.token;
  if (typeof token !== "string" || token.trim() === "")
    throw new Error("login-token exchange returned no token");
  return token;
}

async function adminWorkspaceToken(baseUrl: string): Promise<string> {
  const metadataUrl = `${baseUrl}/metadata`;
  const signIn = dataOf(
    "signIn",
    await call(metadataUrl, undefined, SIGN_IN, {
      email: TWENTY_DEFAULT_ADMIN_EMAIL,
      password: TWENTY_DEV_SEED_PASSWORD,
    }),
  );
  const workspaces = (signIn.availableWorkspaces as Json | undefined)?.availableWorkspacesForSignIn;
  return exchange(metadataUrl, loginTokenOf(workspaces).loginToken, baseUrl);
}

/** Creates one throwaway actor through normal routes. Refuses a bad prefix before any network call. */
export async function createThrowawayActor(opts: CreateActorOptions): Promise<ThrowawayActor> {
  const prefix = opts.runPrefix ?? currentRunPrefix();
  if (!RUN_PREFIX_PATTERN.test(prefix)) {
    throw new Error("TEST BUG: refusing a run prefix that does not match RUN_PREFIX_PATTERN");
  }
  const baseUrl = (opts.baseUrl ?? apiBaseUrl("twenty")).replace(/\/$/, "");
  const index = opts.index ?? 0;
  const email = throwawayEmail(prefix, index);
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const metadataUrl = `${baseUrl}/metadata`;
  const graphqlUrl = `${baseUrl}/graphql`;

  // 1. Admin (inviter only) invites the throwaway email, so sign-up has a provisioned destination.
  const adminToken = await adminWorkspaceToken(baseUrl);
  const invited = dataOf(
    "sendInvitations",
    await call(metadataUrl, adminToken, SEND_INVITATIONS, { emails: [email] }),
  );
  if (invited.success !== true) {
    throw new Error("sendInvitations reported no success for the throwaway email");
  }

  // 2. The throwaway actor signs up through the normal route and exchanges its login token.
  const signUp = dataOf("signUp", await call(metadataUrl, undefined, SIGN_UP, { email, password }));
  const available = signUp.availableWorkspaces as Json | undefined;
  const candidates: Json[] = [
    ...listOf(available?.availableWorkspacesForSignUp),
    ...listOf(available?.availableWorkspacesForSignIn),
  ];
  const picked = loginTokenOf(candidates);
  const accessToken = await exchange(metadataUrl, picked.loginToken, baseUrl);

  // 3. Mint an API key as the actor. If the product refuses it (role without API key rights), the actor
  //    keeps its own login token and the spec records the fallback (D-TWISO-B6 is unaffected).
  const minted: string[] = [];
  let credential = accessToken;
  if (opts.mintApiKey) {
    const expiresAt = new Date(Date.now() + KEY_LIFETIME_MS).toISOString();
    const created = await call(metadataUrl, accessToken, CREATE_API_KEY, {
      input: { name: `${prefix}-iso-key-${index}`, expiresAt },
    });
    const keyId = (dataOf("createApiKey", created).id as string | undefined) ?? undefined;
    if (keyId !== undefined) {
      minted.push(keyId);
      const keyToken = await call(metadataUrl, accessToken, GENERATE_API_KEY_TOKEN, {
        apiKeyId: keyId,
        expiresAt,
      });
      const tokenValue =
        (dataOf("generateApiKeyToken", keyToken).token as string | undefined) ?? "";
      if (tokenValue.trim() === "") throw new Error("generateApiKeyToken returned no token");
      credential = tokenValue;
    }
  }

  return {
    email,
    workspaceId: picked.id,
    authHeaders: () => ({ authorization: `Bearer ${credential}` }),
    revokeAll: async () => {
      let revoked = 0;
      for (const id of minted.splice(0)) {
        dataOf(
          "revokeApiKey",
          await call(metadataUrl, accessToken, REVOKE_API_KEY, { input: { id } }),
        );
        revoked += 1;
        // A refusal is only evidence next to a valid control (rule 3): the actor's own login token must still work.
        const control = await call(graphqlUrl, accessToken, "{ __typename }", {});
        if (control.status !== 200) throw new Error("revoke check has no valid control");
        const after = await call(graphqlUrl, credential, "{ __typename }", {});
        if (after.status === 200 && !after.body.errors) {
          throw new Error("revoked API key still accepted");
        }
      }
      return { revoked };
    },
  };
}
