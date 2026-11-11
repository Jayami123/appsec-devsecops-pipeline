// Classifies one product reply for a tw-iso row (tw-iso.md section 8 rule 6). A refusal that matches the
// expected product message is PASS. An answered request with no matching refusal is a design verdict,
// recorded with what the product said. Any other status is a deployment finding, which fails the row.
// Only product error text (first message, truncated) is returned; no request header or token is kept.
import type { GqlResponse } from "./gql-client.ts";

export type Verdict = "PASS" | "design verdict" | "deployment finding";

export interface Outcome {
  readonly verdict: Verdict;
  readonly status: number;
  /** The first product error message, truncated. Empty when there is none. */
  readonly message: string;
}

/** Product error messages from a GraphQL body (`errors[].message`), in order. */
export function errorMessages(body: unknown): string[] {
  if (typeof body !== "object" || body === null || !("errors" in body)) return [];
  const errors: unknown = body.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e: unknown) =>
      typeof e === "object" && e !== null && "message" in e ? e.message : undefined,
    )
    .filter((m): m is string => typeof m === "string");
}

export function classifyReply(reply: GqlResponse, refusal: RegExp): Outcome {
  const messages = errorMessages(reply.body);
  const first = (messages[0] ?? "").slice(0, 160);
  if (messages.some((m) => refusal.test(m))) {
    return { verdict: "PASS", status: reply.status, message: first };
  }
  // A 200 with no errors is an answered request: a design verdict. Any other error (a validation error
  // that is not the expected refusal) means the probe never reached the limit under test: a finding.
  if (reply.status === 200 && messages.length === 0) {
    return { verdict: "design verdict", status: reply.status, message: "" };
  }
  return { verdict: "deployment finding", status: reply.status, message: first };
}

/** Annotation text for a verdict: verdict, status and the product message (if any). */
export function describe(outcome: Outcome): string {
  const suffix = outcome.message === "" ? "" : `: ${outcome.message}`;
  return `${outcome.verdict} (status ${outcome.status}${suffix})`;
}
