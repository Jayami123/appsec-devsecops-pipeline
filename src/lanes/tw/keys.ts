// API keys through the product routes (packages/twenty-server api-key.resolver.ts:39-132 and
// auth.resolver.ts:1088-1103 generateApiKeyToken; metadata endpoint). The secret is held in memory
// only and is never logged or written to an artefact.
import { gql } from "./gql.ts";
import type { TwSession } from "./login.ts";

export interface TwApiKey {
  readonly id: string;
  readonly secret: string; // never logged, never written to an artefact
}

const KEY_LIFETIME_MS = 60 * 60 * 1000; // a one-hour key is enough for one run (lane-local, not a budget)

/** The role id for a label, e.g. "Admin" or "Object-restricted". Undefined when the label is absent. */
export async function roleIdByLabel(input: {
  readonly baseUrl: string;
  readonly session: TwSession;
  readonly label: string;
}): Promise<string | undefined> {
  const data = await gql<{ getApiKeyRoles: Array<{ id: string; label: string }> }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    bearer: input.session.accessToken,
    operation: "getApiKeyRoles",
    query: `query { getApiKeyRoles { id label } }`,
  });
  return data.getApiKeyRoles.find((role) => role.label === input.label)?.id;
}

export async function createApiKey(input: {
  readonly baseUrl: string;
  readonly session: TwSession;
  readonly name: string;
  readonly roleLabel?: string;
}): Promise<TwApiKey> {
  const roleId = await roleIdByLabel({
    baseUrl: input.baseUrl,
    session: input.session,
    label: input.roleLabel ?? "Admin",
  });
  if (roleId === undefined)
    throw new Error(`TEST BUG: no role labelled ${input.roleLabel ?? "Admin"}`);
  const expiresAt = new Date(Date.now() + KEY_LIFETIME_MS).toISOString();
  const created = await gql<{ createApiKey: { id: string } }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    bearer: input.session.accessToken,
    operation: "createApiKey",
    query: `mutation Create($input: CreateApiKeyInput!) { createApiKey(input: $input) { id } }`,
    variables: { input: { name: input.name, expiresAt, roleId } },
  });
  const token = await gql<{ generateApiKeyToken: { token: string } }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    bearer: input.session.accessToken,
    operation: "generateApiKeyToken",
    query: `mutation Token($apiKeyId: UUID!, $expiresAt: String!) {
      generateApiKeyToken(apiKeyId: $apiKeyId, expiresAt: $expiresAt) { token }
    }`,
    variables: { apiKeyId: created.createApiKey.id, expiresAt },
  });
  return { id: created.createApiKey.id, secret: token.generateApiKeyToken.token };
}

export async function revokeApiKey(input: {
  readonly baseUrl: string;
  readonly session: TwSession;
  readonly keyId: string;
}): Promise<void> {
  await gql<{ revokeApiKey: { id: string } | null }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    bearer: input.session.accessToken,
    operation: "revokeApiKey",
    query: `mutation Revoke($input: RevokeApiKeyInput!) { revokeApiKey(input: $input) { id } }`,
    variables: { input: { id: input.keyId } },
  });
}

/** The HTTP status of one REST read with a bearer token. Returns the status only. */
export async function restStatus(input: {
  readonly baseUrl: string;
  readonly path: string;
  readonly bearer?: string;
}): Promise<number> {
  const headers: Record<string, string> = {};
  if (input.bearer !== undefined) headers.authorization = `Bearer ${input.bearer}`;
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}${input.path}`, { headers });
  return response.status;
}
