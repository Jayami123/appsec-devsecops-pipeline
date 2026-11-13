// Reads the workspace invitation mail of one throwaway recipient from the harness Mailpit (D-TWISO-B23).
// Host and port: fork ref held by the owner prints "Mailpit: http://127.0.0.1:8025"; docker/twenty.compose.yml:7-11
// publishes 8025 for mailpit v1.22.3. The token is kept in memory only: it is never printed or put in an error.
// Deferred harness item: a twentyMailApiUrl() export so this constant is not hard-wired (see the PR body).
export const MAILPIT_BASE_URL = "http://127.0.0.1:8025";

/** The invite token in an invitation link (fork ref held by the owner: query `inviteToken`). */
export function inviteTokenFromText(text: string): string | undefined {
  const match = /[?&;]inviteToken=([^&\s"'<>]+)/.exec(text);
  if (match?.[1] === undefined) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/** The mail search query for one recipient. Mailpit search syntax: `to:<address>`. */
export function mailSearchQuery(email: string): string {
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    throw new RangeError("TEST BUG: recipient is not a plain address");
  }
  return `to:${email}`;
}

interface MailSummary {
  readonly ID?: unknown;
}

/** Returns the body text of the newest message to `email`, or undefined while none has arrived. */
export async function readInviteBody(
  email: string,
  mailBaseUrl: string = MAILPIT_BASE_URL,
): Promise<string | undefined> {
  const search = await fetch(
    `${mailBaseUrl}/api/v1/search?query=${encodeURIComponent(mailSearchQuery(email))}`,
  );
  if (!search.ok) throw new Error(`mail search refused: HTTP ${search.status}`);
  const payload = (await search.json()) as { messages?: MailSummary[] };
  const first = payload.messages?.[0];
  if (first === undefined || typeof first.ID !== "string") return undefined;
  const message = await fetch(`${mailBaseUrl}/api/v1/message/${encodeURIComponent(first.ID)}`);
  if (!message.ok) throw new Error(`mail read refused: HTTP ${message.status}`);
  const body = (await message.json()) as { Text?: unknown; HTML?: unknown };
  return [body.Text, body.HTML].filter((v): v is string => typeof v === "string").join("\n");
}
