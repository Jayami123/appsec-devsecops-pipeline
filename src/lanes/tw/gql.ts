// Minimal GraphQL client for the lane helpers. Errors carry the operation name and the first server
// message only. Never a token, password or response body.
export interface GqlError {
  readonly message: string;
}

export async function gql<T>(input: {
  readonly baseUrl: string;
  readonly operation: string;
  readonly query: string;
  readonly variables?: Record<string, unknown>;
  readonly bearer?: string;
  /** "metadata" for the auth, api key and workspace-management operations; "graphql" for data. */
  readonly endpoint?: "graphql" | "metadata";
}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (input.bearer !== undefined) headers.authorization = `Bearer ${input.bearer}`;
  const path = input.endpoint === "metadata" ? "/metadata" : "/graphql";
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
  });
  const body = (await response.json()) as { data?: T; errors?: GqlError[] };
  if (!response.ok || body.errors !== undefined || body.data === undefined) {
    const first = body.errors?.[0]?.message ?? `HTTP ${response.status}`;
    throw new Error(`${input.operation} failed: ${first}`);
  }
  return body.data;
}
