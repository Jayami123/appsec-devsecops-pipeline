// Personal team of a throwaway actor (D-DOC-B45). The product's tRPC context takes the team ONLY from the
// `x-team-id` request header (fork ref held by the owner); envelope, template and webhook calls that need
// a team fail with 500 (USER_FETCH_FAILED, fork ref held by the owner) or 404 without it.
// Parsers are pure; the wire shape of the tRPC GET is UNVERIFIED until the first CI run (fork ref held by the owner).
import type { APIRequestContext } from "@playwright/test";

/** The first organisation id in a tRPC organisation.getMany body. Throws on any other shape. */
export function organisationIdFrom(body: unknown): string {
  const list = trpcData(body);
  if (!Array.isArray(list) || list.length === 0)
    throw new Error("TEST BUG: no organisation in the list");
  const id = (list[0] as { id?: unknown }).id;
  if (typeof id !== "string" || id === "")
    throw new Error("TEST BUG: organisation id is not a string");
  return id;
}

/** The first team id in a tRPC team.find body (ZFindResultResponse: data array). Throws on any other shape. */
export function teamIdFrom(body: unknown): number {
  const page = trpcData(body) as { data?: unknown } | undefined;
  const teams = page?.data;
  if (!Array.isArray(teams) || teams.length === 0) throw new Error("TEST BUG: no team in the list");
  const id = (teams[0] as { id?: unknown }).id;
  if (typeof id !== "number") throw new Error("TEST BUG: team id is not a number");
  return id;
}

/** The superjson-style payload of a tRPC response: result.data.json (or result.data when no wrapper). */
function trpcData(body: unknown): unknown {
  const result = (body as { result?: { data?: unknown } } | null)?.result?.data;
  if (result === undefined) throw new Error("TEST BUG: tRPC response has no result.data");
  const wrapped = (result as { json?: unknown }).json;
  return wrapped !== undefined ? wrapped : result;
}

/** Resolves the signed-in user's personal team id: organisation.getMany, then team.find for that organisation. */
export async function resolvePersonalTeamId(
  request: APIRequestContext,
  baseUrl: string,
): Promise<number> {
  const orgs = await request.get(`${baseUrl}/api/trpc/organisation.getMany`);
  if (!orgs.ok()) throw new Error(`organisation.getMany returned ${orgs.status()}`);
  const organisationId = organisationIdFrom(await orgs.json());
  const input = encodeURIComponent(
    JSON.stringify({ json: { organisationId, page: 1, perPage: 10 } }),
  );
  const teams = await request.get(`${baseUrl}/api/trpc/team.find?input=${input}`);
  if (!teams.ok()) throw new Error(`team.find returned ${teams.status()}`);
  return teamIdFrom(await teams.json());
}
