// Multi-workspace support for the @multiws rows (the tw-multiws job only). The rows use the README recipe of the
// harness (Twenty multi-workspace recipe): TWENTY_BASE_URL on lvh.me, IS_MULTIWORKSPACE_ENABLED=true and
// IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS=false at up. A workspace origin is <subdomain>.<host of TWENTY_BASE_URL>.
//
// apiBaseUrl() is not used here. src/kit/env.ts (loopbackUrl) accepts only 127.0.0.1, localhost and [::1] as the
// hostname, so the recipe value fails loadEnv (D-TW-B46). The loopback property is checked by resolution instead
// (assertLoopbackRecipeName). Nothing is written to /etc/hosts.
//
// Throwaway actors only. Each owner signs up through the product, and every name carries the run prefix. Invite mail
// is read from the harness mail API (twentyMailApiUrl), filtered by the recipient address. Bodies, links and tokens
// are held in memory only and are never printed.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  TWENTY_DEV_SEED_PASSWORD,
  TWENTY_SEED_APPLE_WORKSPACE_SUBDOMAIN,
  TWENTY_SEED_YC_WORKSPACE_SUBDOMAIN,
  twentyMailApiUrl,
} from "qa-portfolio-harness";
import { gql } from "../../../src/lanes/tw/gql.ts";
import { awaitInviteLink, joinWorkspace } from "../../../src/lanes/tw/member.ts";
import {
  adminSetupSession,
  throwawayEmail,
  throwawayPassword,
  type TwSession,
} from "../../../src/lanes/tw/login.ts";

/** The two flags the README recipe sets at up. Values are public flags, not secrets. */
export const RECIPE_FLAGS = {
  IS_MULTIWORKSPACE_ENABLED: "true",
  IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS: "false",
} as const;

/** An ENV failure: the stack does not carry the recipe, or the name does not resolve to loopback. */
export class EnvRecipeError extends Error {}

/** Fails closed unless the run carries the recipe. Returns the root URL from TWENTY_BASE_URL. */
export function recipeRootUrl(env: NodeJS.ProcessEnv = process.env): URL {
  for (const [name, value] of Object.entries(RECIPE_FLAGS)) {
    if (env[name] !== value) {
      throw new EnvRecipeError(
        `ENV: ${name} is not "${value}" on this stack (the @multiws rows need the README recipe)`,
      );
    }
  }
  const raw = env["TWENTY_BASE_URL"];
  if (raw === undefined || raw.trim() === "") {
    throw new EnvRecipeError("ENV: TWENTY_BASE_URL is not set (README recipe: http://lvh.me:3002)");
  }
  const url = new URL(raw);
  if (url.protocol !== "http:") {
    throw new EnvRecipeError(
      "ENV: TWENTY_BASE_URL must be http (the harness starts Twenty over http)",
    );
  }
  if (url.hostname === "localhost" || isIP(url.hostname) !== 0) {
    throw new EnvRecipeError(
      "ENV: TWENTY_BASE_URL needs a wildcard name such as lvh.me (an IP or localhost cannot carry a subdomain)",
    );
  }
  return url;
}

/**
 * Requires the name to resolve, and every address it resolves to to be loopback. A name that does not resolve is an
 * ENV failure with the resolver code only. No workaround (hosts file, IP) is attempted.
 */
export async function assertLoopbackRecipeName(hostname: string): Promise<void> {
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    throw new EnvRecipeError(`ENV: ${hostname} does not resolve on this runner (${code})`);
  }
  const loopback =
    addresses.length > 0 &&
    addresses.every(({ address }) => address === "127.0.0.1" || address === "::1");
  if (!loopback) throw new EnvRecipeError(`ENV: ${hostname} does not resolve only to loopback`);
}

/** The origin of one workspace from the recipe: <subdomain>.<host of TWENTY_BASE_URL>, same port. */
export function workspaceOrigin(subdomain: string, root: URL): string {
  if (!/^[a-z0-9-]{1,63}$/.test(subdomain))
    throw new Error("TEST BUG: subdomain is not a DNS label");
  return `${root.protocol}//${subdomain}.${root.host}`;
}

export interface MultiworkspaceMember {
  /** The workspace origin (the seeded subdomain on the README recipe host). */
  readonly origin: string;
  /** A throwaway member of that workspace, invited through the product. */
  readonly session: TwSession;
  /** The workspace admin, used as setup only (invites, API keys). Never an actor under test (D-TW-B5). */
  readonly admin: TwSession;
  readonly email: string;
  readonly password: string;
}

/** A: a member of the YC workspace. B: a member of the Apple workspace. Each is a throwaway member. */
export interface MultiworkspacePair {
  readonly a: MultiworkspaceMember;
  readonly b: MultiworkspaceMember;
}

/**
 * The YC admin of the dev seed is a seed user whose login is in the harness dev-seed data (detail held by the owner).
 * The shared dev-seed password is the harness export TWENTY_DEV_SEED_PASSWORD. Setup only.
 */
const YC_SEED_ADMIN_EMAIL = "tim@apple.dev";

const SEED_LOGIN = `mutation Login($email: String!, $password: String!, $origin: String!) {
  getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) { loginToken { token } }
}`;
const SEED_EXCHANGE = `mutation Exchange($loginToken: String!, $origin: String!) {
  getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
    tokens { accessOrWorkspaceAgnosticToken { token } }
  }
}`;

/**
 * A session on a seeded workspace for a seed admin (setup only). Same product mutations as loginThrowaway, without the
 * throwaway-prefix guard, because the seed admin is not a throwaway actor.
 */
async function seedAdminSession(
  origin: string,
  email: string,
  password: string,
): Promise<TwSession> {
  const login = await gql<{ getLoginTokenFromCredentials: { loginToken: { token: string } } }>({
    baseUrl: origin,
    endpoint: "metadata",
    operation: "getLoginTokenFromCredentials",
    query: SEED_LOGIN,
    variables: { email, password, origin },
  });
  const exchanged = await gql<{
    getAuthTokensFromLoginToken: { tokens: { accessOrWorkspaceAgnosticToken: { token: string } } };
  }>({
    baseUrl: origin,
    endpoint: "metadata",
    operation: "getAuthTokensFromLoginToken",
    query: SEED_EXCHANGE,
    variables: { loginToken: login.getLoginTokenFromCredentials.loginToken.token, origin },
  });
  const accessToken =
    exchanged.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
  const current = await gql<{ currentWorkspace: { id: string } }>({
    baseUrl: origin,
    endpoint: "metadata",
    operation: "currentWorkspace",
    query: `query { currentWorkspace { id } }`,
    bearer: accessToken,
  });
  return { accessToken, workspaceId: current.currentWorkspace.id };
}

/** One throwaway member, invited by the workspace admin through the product (invite mail read by recipient). */
async function invitedMember(input: {
  readonly origin: string;
  readonly admin: TwSession;
  readonly prefix: string;
  readonly label: string;
}): Promise<MultiworkspaceMember> {
  const email = throwawayEmail(input.prefix, input.label);
  const password = throwawayPassword();
  const session = await joinWorkspace({
    baseUrl: input.origin,
    admin: input.admin,
    email,
    password,
    awaitLink: () => awaitInviteLink(email),
  });
  return { origin: input.origin, session, admin: input.admin, email, password };
}

/**
 * The two rows' workspaces: the seeded YC and Apple workspaces on the recipe host (D-TW-B50). A throwaway member is
 * invited into each. Workspace creation is not used: the stack limits the number of workspaces without an enterprise
 * key (detail held by the owner), and the seeded pair is within the recipe. The seed subdomains are the harness exports.
 */
export async function seededPair(input: {
  readonly root: URL;
  readonly prefix: string;
  readonly label: string;
}): Promise<MultiworkspacePair> {
  const ycOrigin = workspaceOrigin(TWENTY_SEED_YC_WORKSPACE_SUBDOMAIN, input.root);
  const appleOrigin = workspaceOrigin(TWENTY_SEED_APPLE_WORKSPACE_SUBDOMAIN, input.root);
  const ycAdmin = await seedAdminSession(ycOrigin, YC_SEED_ADMIN_EMAIL, TWENTY_DEV_SEED_PASSWORD);
  const appleAdmin = await adminSetupSession(appleOrigin); // setup only (D-TW-B5)
  const a = await invitedMember({
    origin: ycOrigin,
    admin: ycAdmin,
    prefix: input.prefix,
    label: `${input.label}a`,
  });
  const b = await invitedMember({
    origin: appleOrigin,
    admin: appleAdmin,
    prefix: input.prefix,
    label: `${input.label}b`,
  });
  return { a, b };
}

/** Creates one company in a workspace (REST). Returns its id; the name carries the run prefix. */
export async function createCompany(input: {
  readonly origin: string;
  readonly session: TwSession;
  readonly name: string;
}): Promise<string> {
  const response = await fetch(`${input.origin}/rest/companies`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.session.accessToken}`,
    },
    body: JSON.stringify({ name: input.name }),
  });
  const body = (await response.json()) as { data?: { createCompany?: { id?: string } } };
  const id = body.data?.createCompany?.id;
  if (response.status !== 201 || id === undefined) {
    throw new Error(`TEST BUG: company create returned ${response.status}`);
  }
  return id;
}

/** One REST read with a bearer token. Returns the status and the raw text (the caller checks for values). */
export async function readRest(input: {
  readonly url: string;
  readonly bearer?: string;
}): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = {};
  if (input.bearer !== undefined) headers.authorization = `Bearer ${input.bearer}`;
  const response = await fetch(input.url, { headers });
  return { status: response.status, text: await response.text() };
}

/** The invite hash addressed to one recipient in the mail API, or undefined until the mail arrives. */
export async function findInviteHash(email: string): Promise<string | undefined> {
  const search = await fetch(
    `${twentyMailApiUrl}/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const found = (await search.json()) as { messages?: Array<{ ID: string }> };
  const id = found.messages?.[0]?.ID;
  if (id === undefined) return undefined;
  const message = (await (await fetch(`${twentyMailApiUrl}/message/${id}`)).json()) as {
    Text?: string;
    HTML?: string;
  };
  // Quoted-printable soft breaks, =3D and HTML-escaped ampersands are decoded before matching.
  const body = `${message.Text ?? ""}\n${message.HTML ?? ""}`
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=")
    .replace(/&amp;/g, "&");
  const match = /\/invite\/([^?\s"'<>]+)\?inviteToken=([^&;\s"'<>]+)/.exec(body);
  return match?.[1];
}

/** Workspace members of one origin, filtered by email (REST). Returns the member ids found. */
export async function memberIdsByEmail(input: {
  readonly origin: string;
  readonly session: TwSession;
  readonly email: string;
}): Promise<string[]> {
  const response = await fetch(
    `${input.origin}/rest/workspaceMembers?limit=1&filter=userEmail[eq]:${encodeURIComponent(input.email)}`,
    { headers: { authorization: `Bearer ${input.session.accessToken}` } },
  );
  const body = (await response.json()) as {
    data?: { workspaceMembers?: Array<{ id: string; userEmail: string }> };
  };
  return (body.data?.workspaceMembers ?? [])
    .filter((row) => row.userEmail === input.email)
    .map((row) => row.id);
}

/** One PNG, the same bytes the single-workspace upload test uses (a valid 1x1 image). */
export const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f8e1b00000000049454e44ae426082",
  "hex",
);

/**
 * Uploads the PNG as a file in one workspace (the two-step product route, metadata endpoint) and returns the signed
 * URL, resolved against that workspace origin. Mirrors tests/contracts/tw/upload-content-type.spec.ts.
 */
export async function uploadPng(input: {
  readonly origin: string;
  readonly session: TwSession;
  readonly filename: string;
}): Promise<string> {
  const call = async (query: string, variables: object) =>
    (await (
      await fetch(`${input.origin}/metadata`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.session.accessToken}`,
        },
        body: JSON.stringify({ query, variables }),
      })
    ).json()) as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
  const target = await call(
    `mutation T($filename: String!, $size: Float!, $fileFolder: FileFolder!) { createFileUpload(filename: $filename, size: $size, fileFolder: $fileFolder) { fileId uploadUrl contentType } }`,
    { filename: input.filename, size: PNG.length, fileFolder: "EmailAttachment" },
  );
  const t = target.data?.createFileUpload as { fileId: string; uploadUrl: string } | undefined;
  if (t === undefined)
    throw new Error(`TEST BUG: createFileUpload: ${target.errors?.[0]?.message ?? "no data"}`);
  const put = await fetch(t.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: PNG,
  });
  if (put.status !== 204) throw new Error(`TEST BUG: file PUT returned ${put.status}`);
  const done = await call(
    `mutation C($fileId: String!) { completeFileUpload(fileId: $fileId) { url } }`,
    { fileId: t.fileId },
  );
  const url = (done.data?.completeFileUpload as { url?: string } | undefined)?.url;
  if (url === undefined)
    throw new Error(`TEST BUG: completeFileUpload: ${done.errors?.[0]?.message ?? "no url"}`);
  return new URL(url, input.origin).toString();
}
