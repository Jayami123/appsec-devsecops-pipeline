// Throwaway members are created by the workspace admin through the invite route (sign-up without a
// workspace is disabled: "New workspace setup is disabled"). The invite email is read from Mailpit
// (D-TW-B5). Bodies and links are never printed or stored; only the parsed values are returned to the
// caller in memory.
import { gql } from "./gql.ts";
import type { TwSession } from "./login.ts";

export const MAILPIT_BASE_URL = "http://127.0.0.1:8025";

export interface InviteLink {
  /** The workspace invite hash (path segment of /invite/<hash>). Held in memory only. */
  readonly workspaceInviteHash: string;
}

/** Sends an invite to one email as the workspace admin (metadata endpoint, sendInvitations). */
export async function sendInvite(input: {
  readonly baseUrl: string;
  readonly admin: TwSession;
  readonly email: string;
  readonly roleId?: string;
}): Promise<void> {
  const result = await gql<{ sendInvitations: { success: boolean } }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    bearer: input.admin.accessToken,
    operation: "sendInvitations",
    query: `mutation Invite($emails: [String!]!, $roleId: UUID) {
      sendInvitations(emails: $emails, roleId: $roleId) { success }
    }`,
    variables: { emails: [input.email], roleId: input.roleId ?? null },
  });
  if (!result.sendInvitations.success) throw new Error("sendInvitations returned success=false");
}

/**
 * Finds the invite link addressed to one email in Mailpit. Returns undefined until the mail arrives.
 * Callers wait with expect.poll (never a sleep). The message body is parsed in memory and never logged.
 */
export async function findInviteLink(email: string): Promise<InviteLink | undefined> {
  const search = await fetch(
    `${MAILPIT_BASE_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const found = (await search.json()) as { messages?: Array<{ ID: string }> };
  const id = found.messages?.[0]?.ID;
  if (id === undefined) return undefined;
  const message = (await (await fetch(`${MAILPIT_BASE_URL}/api/v1/message/${id}`)).json()) as {
    Text?: string;
    HTML?: string;
  };
  // Quoted-printable soft breaks, =3D and HTML-escaped ampersands are decoded before matching.
  const body = `${message.Text ?? ""}\n${message.HTML ?? ""}`
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=")
    .replace(/&amp;/g, "&");
  const match = /\/invite\/([^?\s"'<>]+)\?inviteToken=([^&;\s"'<>]+)/.exec(body);
  if (match === null || match[1] === undefined) return undefined;
  return { workspaceInviteHash: match[1] };
}

/** Accepts an invite as the invitee: sets the password and joins the workspace (metadata endpoint). */
export async function acceptInvite(input: {
  readonly baseUrl: string;
  readonly email: string;
  readonly password: string;
  readonly workspaceInviteHash: string;
}): Promise<void> {
  await gql<{ signUpInWorkspace: { workspace: { id: string } } }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    operation: "signUpInWorkspace",
    query: `mutation Accept($email: String!, $password: String!, $hash: String!) {
      signUpInWorkspace(email: $email, password: $password, workspaceInviteHash: $hash) { workspace { id } }
    }`,
    variables: { email: input.email, password: input.password, hash: input.workspaceInviteHash },
  });
}
