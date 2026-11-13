// Cal mail catcher reader (harness v0.5.0 `calMailApiUrl`, Mailpit on 127.0.0.1:8026). Read-only:
// lists messages addressed to one throwaway email and returns the full text of the matching ones.
// Mail bodies can carry reset links; callers extract what they need and never print the body.
import { calMailApiUrl } from "qa-portfolio-harness";

export interface CatcherMessage {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

interface ListResponse {
  readonly messages?: ReadonlyArray<{
    readonly ID: string;
    readonly Subject: string;
    readonly To: ReadonlyArray<{ readonly Address: string }>;
  }>;
}

/** Full messages to `email` whose subject contains `subjectPart`, oldest first. */
export async function catcherMessagesFor(
  email: string,
  subjectPart: string,
): Promise<CatcherMessage[]> {
  const listRes = await fetch(`${calMailApiUrl}/messages`);
  if (!listRes.ok) throw new Error(`MAIL_LIST_FAILED status ${listRes.status}`);
  const list = (await listRes.json()) as ListResponse;
  const matches = (list.messages ?? []).filter(
    (m) => m.To.some((t) => t.Address === email) && m.Subject.includes(subjectPart),
  );
  const out: CatcherMessage[] = [];
  for (const m of matches.reverse()) {
    const res = await fetch(`${calMailApiUrl}/message/${m.ID}`);
    if (!res.ok) throw new Error(`MAIL_READ_FAILED status ${res.status}`);
    const full = (await res.json()) as { Subject: string; Text: string; HTML: string };
    out.push({ subject: full.Subject, text: full.Text, html: full.HTML });
  }
  return out;
}

/**
 * Full messages whose subject starts with `subjectStart`, oldest first. Used when the recipient header is
 * not reliable: a booker name carrying markup can leave Mailpit with an empty To list for the attendee
 * copy. The caller passes a title unique to its test, so messages from earlier runs cannot match.
 */
export async function catcherMessagesStartingWith(subjectStart: string): Promise<CatcherMessage[]> {
  const listRes = await fetch(`${calMailApiUrl}/messages`);
  if (!listRes.ok) throw new Error(`MAIL_LIST_FAILED status ${listRes.status}`);
  const list = (await listRes.json()) as ListResponse;
  const matches = (list.messages ?? []).filter((m) => m.Subject.startsWith(subjectStart));
  const out: CatcherMessage[] = [];
  for (const m of matches.reverse()) {
    const res = await fetch(`${calMailApiUrl}/message/${m.ID}`);
    if (!res.ok) throw new Error(`MAIL_READ_FAILED status ${res.status}`);
    const full = (await res.json()) as { Subject: string; Text: string; HTML: string };
    out.push({ subject: full.Subject, text: full.Text, html: full.HTML });
  }
  return out;
}
