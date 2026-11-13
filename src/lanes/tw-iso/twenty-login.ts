// Throwaway actor for the tw-iso rows (tw-iso.md section 10; D-TWISO-B24 reverses B14).
// Route, all normal product routes:
//   a. the dev-seed admin (inviter only) calls sendInvitations on /metadata (fork ref held by the owner);
//   b. the invitation mail is read from the harness Mailpit (invite-mail.ts), with expect.poll (D-TWISO-B23);
//   c. the invitee calls signUpInWorkspace on /metadata (fork ref held by the owner), which takes the personal
//      invite token and never runs the workspace-agnostic sign-up gate (fork ref held by the owner);
//   d. the login token is exchanged for the member's access token (getAuthTokensFromLoginToken).
// The dev-seed admin is never an actor. Credentials, invite tokens and key values stay in memory.
import { randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { TWENTY_DEFAULT_ADMIN_EMAIL, TWENTY_DEV_SEED_PASSWORD } from "qa-portfolio-harness";
import { apiBaseUrl } from "../../kit/env.ts";
import { RUN_PREFIX_PATTERN, currentRunPrefix } from "../../kit/run/prefix.ts";
import { inviteTokenFromText, readInviteBody } from "./invite-mail.ts";

export interface CleanupEvidence {
  /** The member's credential was accepted by an authenticated query before the removal (control). */
  readonly controlBeforeDelete: boolean;
  readonly keysRevoked: number;
  readonly invitationsDeleted: number;
  readonly memberDeleted: boolean;
  /** The member's credential is refused by an authenticated query after the removal (after-check). */
  readonly refusedAfterDelete: boolean;
}

export interface ThrowawayActor {
  /** Throwaway email; always starts with the run prefix. */
  readonly email: string;
  /** Workspace the actor belongs to, as returned by the normal route. */
  readonly workspaceId: string;
  /** "api-key" when the product minted a key for the actor; "access-token" when key minting was refused. */
  readonly credentialMode: () => "api-key" | "access-token";
  /** Why the key attempt ended as it did (product message only, no value). */
  readonly keyAttempt: () => string;
  /** Headers for the actor's credential. Never logged. */
  authHeaders(): Record<string, string>;
  /** True while an authenticated query (currentUser on /metadata) accepts the actor's credential. */
  isAuthenticated(): Promise<boolean>;
  /** Removes the actor's keys, pending invitations and member row, then checks the refusal. */
  cleanup(): Promise<CleanupEvidence>;
}

export interface CreateActorOptions {
  /** From currentRunPrefix() in src/kit/run/prefix.ts. Must match RUN_PREFIX_PATTERN. */
  runPrefix?: string;
  /** From the harness readiness output. Never a literal host. */
  baseUrl?: string;
  /** When true, attempt an API key as the actor; a refusal falls back to the actor's login token. */
  mintApiKey: boolean;
  /** Distinct per call within a run. */
  index?: number;
}

const SIGN_IN = `mutation SignIn($email: String!, $password: String!) {
  signIn(email: $email, password: $password) {
    availableWorkspaces { availableWorkspacesForSignIn { id loginToken } }
  }
}`;
const EXCHANGE = `mutation Exchange($loginToken: String!, $origin: String!) {
  getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
    tokens { accessOrWorkspaceAgnosticToken { token } }
  }
}`;
const SEND_INVITATIONS = `mutation SendInvitations($emails: [String!]!) {
  sendInvitations(emails: $emails) { success errors }
}`;
const FIND_INVITATIONS = `{ findWorkspaceInvitations { id email } }`;
const DELETE_INVITATION = `mutation DeleteInvitation($id: String!) {
  deleteWorkspaceInvitation(appTokenId: $id)
}`;
const SIGN_UP_IN_WORKSPACE = `mutation SignUpInWorkspace($email: String!, $password: String!, $workspaceId: UUID, $token: String) {
  signUpInWorkspace(email: $email, password: $password, workspaceId: $workspaceId, workspacePersonalInviteToken: $token) {
    loginToken { token }
  }
}`;
const CURRENT_USER = `{ currentUser { id email } }`;
const API_KEY_ROLES = `{ getApiKeyRoles { id label } }`;
const CREATE_API_KEY = `mutation CreateApiKey($input: CreateApiKeyInput!) {
  createApiKey(input: $input) { id }
}`;
const GENERATE_API_KEY_TOKEN = `mutation GenerateApiKeyToken($apiKeyId: UUID!, $expiresAt: String!) {
  generateApiKeyToken(apiKeyId: $apiKeyId, expiresAt: $expiresAt) { token }
}`;
const REVOKE_API_KEY = `mutation RevokeApiKey($input: RevokeApiKeyInput!) {
  revokeApiKey(input: $input) { id }
}`;
const MEMBER_BY_EMAIL = `query MemberByEmail($email: String!) {
  workspaceMembers(filter: { userEmail: { eq: $email } }) { edges { node { id } } }
}`;
const DELETE_MEMBER = `mutation DeleteMember($id: String!) {
  deleteUserFromWorkspace(workspaceMemberIdToDelete: $id) { id }
}`;

const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

type Json = Record<string, unknown>;

interface Reply {
  readonly status: number;
  readonly body: Json;
}

/** Pure: the throwaway email for one actor in one run. */
export function throwawayEmail(prefix: string, index: number, nonce = ""): string {
  if (!RUN_PREFIX_PATTERN.test(prefix)) {
    throw new Error("TEST BUG: run prefix does not match RUN_PREFIX_PATTERN");
  }
  return `${prefix}-iso-${index}${nonce === "" ? "" : `-${nonce}`}@example.test`;
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

function errorText(reply: Reply): string {
  const errors = reply.body.errors;
  const first = Array.isArray(errors)
    ? (errors[0] as { message?: unknown } | undefined)
    : undefined;
  return typeof first?.message === "string" ? first.message.slice(0, 120) : "no message";
}

/** Returns data[op] or throws. The error text is the product's message only, never a body or a token. */
function dataOf(op: string, reply: Reply): Json {
  const errors = reply.body.errors;
  const data = reply.body.data as Json | null | undefined;
  if (reply.status !== 200 || !data || (Array.isArray(errors) && errors.length > 0)) {
    throw new Error(`${op} refused: HTTP ${reply.status} (${errorText(reply)})`);
  }
  const value = data[op];
  if (value === undefined || value === null) throw new Error(`${op} returned no data`);
  return value as Json;
}

function listOf(value: unknown): Json[] {
  return Array.isArray(value) ? (value as Json[]) : [];
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

interface AdminSession {
  readonly token: string;
  readonly workspaceId: string;
}

/** The dev-seed admin, used only as the inviter and for cleanup. Never an actor. */
async function adminSession(baseUrl: string): Promise<AdminSession> {
  const metadataUrl = `${baseUrl}/metadata`;
  const signIn = dataOf(
    "signIn",
    await call(metadataUrl, undefined, SIGN_IN, {
      email: TWENTY_DEFAULT_ADMIN_EMAIL,
      password: TWENTY_DEV_SEED_PASSWORD,
    }),
  );
  const workspaces = listOf(
    (signIn.availableWorkspaces as Json | undefined)?.availableWorkspacesForSignIn,
  );
  const first = workspaces.find(
    (w) => typeof w.loginToken === "string" && typeof w.id === "string",
  );
  if (first === undefined) throw new Error("admin sign-in returned no workspace login token");
  const token = await exchange(metadataUrl, first.loginToken as string, baseUrl);
  return { token, workspaceId: first.id as string };
}

/** Creates one throwaway member through the invitee route. Refuses a bad prefix before any network call. */
export async function createThrowawayActor(opts: CreateActorOptions): Promise<ThrowawayActor> {
  const prefix = opts.runPrefix ?? currentRunPrefix();
  if (!RUN_PREFIX_PATTERN.test(prefix)) {
    throw new Error("TEST BUG: refusing a run prefix that does not match RUN_PREFIX_PATTERN");
  }
  const baseUrl = (opts.baseUrl ?? apiBaseUrl("twenty")).replace(/\/$/, "");
  const index = opts.index ?? 0;
  // A fresh nonce per actor: the same run id and index in an earlier run would find that run's invitation mail (D-TWISO-B34).
  const email = throwawayEmail(prefix, index, randomBytes(4).toString("hex"));
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const metadataUrl = `${baseUrl}/metadata`;
  const graphqlUrl = `${baseUrl}/graphql`;

  // a. The inviter sends the invitation.
  const admin = await adminSession(baseUrl);
  const sent = dataOf(
    "sendInvitations",
    await call(metadataUrl, admin.token, SEND_INVITATIONS, { emails: [email] }),
  );
  if (sent.success !== true)
    throw new Error("sendInvitations reported no success for the throwaway email");

  // b. The invitation mail arrives; the poll deadline is the configured expect timeout (B23).
  let inviteToken: string | undefined;
  await expect
    .poll(
      async () => {
        inviteToken = inviteTokenFromText((await readInviteBody(email)) ?? "");
        return inviteToken !== undefined;
      },
      { message: "invitation mail reached the harness Mailpit" },
    )
    .toBe(true);
  if (inviteToken === undefined) throw new Error("invitation mail carried no invite token");

  // c. The invitee signs up with the personal invite token, then d. exchanges the login token.
  const signUp = dataOf(
    "signUpInWorkspace",
    await call(metadataUrl, undefined, SIGN_UP_IN_WORKSPACE, {
      email,
      password,
      workspaceId: admin.workspaceId,
      token: inviteToken,
    }),
  );
  const loginToken = (signUp.loginToken as Json | undefined)?.token;
  if (typeof loginToken !== "string") throw new Error("signUpInWorkspace returned no login token");
  const memberToken = await exchange(metadataUrl, loginToken, baseUrl);

  // f. API key: attempted as the actor with a role the admin lists; a refusal keeps the login token.
  const minted: string[] = [];
  let credential = memberToken;
  let keyAttempt = "not attempted: no key role listed for the admin";
  const roles = listOf(
    dataOf("getApiKeyRoles", await call(metadataUrl, admin.token, API_KEY_ROLES, {})),
  );
  const keyRole = roles.find((r) => /object-restricted/i.test(String(r.label)));
  if (opts.mintApiKey && keyRole !== undefined) {
    const created = await call(metadataUrl, memberToken, CREATE_API_KEY, {
      input: {
        name: `${prefix}-iso-key-${index}`,
        expiresAt: new Date(Date.now() + KEY_LIFETIME_MS).toISOString(),
        roleId: keyRole.id,
      },
    });
    if (created.body.errors !== undefined) {
      keyAttempt = `createApiKey refused: ${errorText(created)}`;
    } else {
      const keyId = (dataOf("createApiKey", created).id as string | undefined) ?? "";
      minted.push(keyId);
      const expiresAt = new Date(Date.now() + KEY_LIFETIME_MS).toISOString();
      const keyToken = await call(metadataUrl, memberToken, GENERATE_API_KEY_TOKEN, {
        apiKeyId: keyId,
        expiresAt,
      });
      const value = (dataOf("generateApiKeyToken", keyToken).token as string | undefined) ?? "";
      if (value.trim() === "") throw new Error("generateApiKeyToken returned no token");
      credential = value;
      keyAttempt = "createApiKey accepted";
    }
  }
  const mode: "api-key" | "access-token" = credential === memberToken ? "access-token" : "api-key";

  const isAuthenticated = async (): Promise<boolean> => {
    const reply = await call(metadataUrl, credential, CURRENT_USER, {});
    return reply.status === 200 && reply.body.errors === undefined && reply.body.data !== undefined;
  };

  return {
    email,
    workspaceId: admin.workspaceId,
    credentialMode: () => mode,
    keyAttempt: () => keyAttempt,
    authHeaders: () => ({ authorization: `Bearer ${credential}` }),
    isAuthenticated,
    cleanup: async () => {
      const controlBeforeDelete = await isAuthenticated();
      // Keys first (revoked with the member's own login token).
      let keysRevoked = 0;
      for (const id of minted.splice(0)) {
        dataOf(
          "revokeApiKey",
          await call(metadataUrl, memberToken, REVOKE_API_KEY, { input: { id } }),
        );
        keysRevoked += 1;
      }
      // Pending invitations for this address (admin; id is the app token id, cast-app-token util).
      const invitations = listOf(
        dataOf(
          "findWorkspaceInvitations",
          await call(metadataUrl, admin.token, FIND_INVITATIONS, {}),
        ),
      );
      let invitationsDeleted = 0;
      for (const invitation of invitations.filter((i) => i.email === email)) {
        dataOf(
          "deleteWorkspaceInvitation",
          await call(metadataUrl, admin.token, DELETE_INVITATION, { id: invitation.id }),
        );
        invitationsDeleted += 1;
      }
      // The member row (admin; deleteUserFromWorkspace guard: CustomPermissionGuard, fork ref held by the owner).
      const lookup = await call(graphqlUrl, admin.token, MEMBER_BY_EMAIL, { email });
      const members = listOf(
        ((lookup.body.data as Json | undefined)?.workspaceMembers as Json | undefined)?.edges,
      );
      let memberDeleted = false;
      const memberId = (members[0]?.node as Json | undefined)?.id;
      if (typeof memberId === "string") {
        dataOf(
          "deleteUserFromWorkspace",
          await call(metadataUrl, admin.token, DELETE_MEMBER, { id: memberId }),
        );
        memberDeleted = true;
      }
      const refusedAfterDelete = !(await isAuthenticated());
      return {
        controlBeforeDelete,
        keysRevoked,
        invitationsDeleted,
        memberDeleted,
        refusedAfterDelete,
      };
    },
  };
}
