// GraphQL request helper for the tw-iso rows. Calls the product's own /graphql route through the
// harness base URL. Anonymous when `actor` is null. Headers and bodies are never logged.
import { apiBaseUrl } from "../../kit/env.ts";
import type { ThrowawayActor } from "./twenty-login.ts";

export interface GqlResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST one GraphQL document. The caller decides what a status or error body means. */
export async function gqlPost(
  actor: ThrowawayActor | null,
  document: string,
  baseUrl: string = apiBaseUrl("twenty"),
): Promise<GqlResponse> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== null) Object.assign(headers, actor.authHeaders());
  const response = await fetch(`${baseUrl}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: document }),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON bodies are kept as text; the caller matches on status.
  }
  return { status: response.status, body };
}
