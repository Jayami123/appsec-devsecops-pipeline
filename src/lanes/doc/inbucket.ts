// Inbucket mail catcher used by the harness Documenso stack (harness docker/documenso.compose.yml:28-32).
// The API base is copied from qa-portfolio-harness src/config.ts:14 (`documensoMailApiUrl`). The harness
// index is NOT imported: its module side effects load the harness .env into the test process (config.ts:11),
// which AGENTS.md forbids (D-DOC-B17).
import type { APIRequestContext } from "@playwright/test";

export const DOC_MAIL_API_URL = "http://127.0.0.1:9003/api/v1/mailbox";

interface InbucketSummary {
  readonly id: string;
}

interface InbucketMessage {
  readonly body?: { readonly text?: string; readonly html?: string };
}

/** Mailbox name for a run-prefixed address: Inbucket names a mailbox by the local part. Only run-prefixed addresses. */
export function mailboxFor(address: string, runPrefix: string): string {
  const at = address.lastIndexOf("@");
  const local = at > 0 ? address.slice(0, at) : "";
  if (!local.startsWith(`${runPrefix}-`)) {
    throw new Error("TEST BUG: refusing to read a mailbox that is not run-prefixed");
  }
  return local;
}

/**
 * First URL in `body` whose path starts with `pathPrefix`, or null. Pure. The caller must never print the
 * returned value: sign-up and signing links carry tokens.
 */
export function extractFirstLink(body: string, pathPrefix: string): string | null {
  for (const match of body.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    const candidate = match[0];
    try {
      if (new URL(candidate).pathname.startsWith(pathPrefix)) return candidate;
    } catch {
      // Not a parseable URL: skip it. Never echo it.
    }
  }
  return null;
}

/**
 * Body of the newest message for a run-prefixed address, or null when none has arrived yet.
 * Message bodies hold tokens: callers pass them to extractFirstLink and never print them (D-DOC-B8).
 */
export async function latestMessageBodyFor(
  request: APIRequestContext,
  address: string,
  runPrefix: string,
): Promise<string | null> {
  const mailbox = mailboxFor(address, runPrefix);
  const list = await request.get(`${DOC_MAIL_API_URL}/${mailbox}`);
  if (list.status() !== 200) throw new Error(`ENV: mailbox list returned ${list.status()}`);
  const items = (await list.json()) as InbucketSummary[];
  const newest = items[0];
  if (!newest) return null;
  const message = await request.get(
    `${DOC_MAIL_API_URL}/${mailbox}/${encodeURIComponent(newest.id)}`,
  );
  if (message.status() !== 200)
    throw new Error(`ENV: mailbox message returned ${message.status()}`);
  const parsed = (await message.json()) as InbucketMessage;
  return parsed.body?.text ?? parsed.body?.html ?? "";
}
