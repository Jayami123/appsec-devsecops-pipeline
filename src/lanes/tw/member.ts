// A throwaway workspace member, created by the admin through the invite route (D-TW-B5). The mail
// wait is supplied by the caller and must be an expect.poll (never a sleep).
import { expect } from "@playwright/test";
import { acceptInvite, findInviteLink, sendInvite, type InviteLink } from "./invite.ts";
import { loginThrowaway, type TwSession } from "./login.ts";

export async function joinWorkspace(input: {
  readonly baseUrl: string;
  readonly admin: TwSession;
  readonly email: string;
  readonly password: string;
  readonly roleId?: string;
  readonly awaitLink: () => Promise<InviteLink>;
}): Promise<TwSession> {
  await sendInvite({
    baseUrl: input.baseUrl,
    admin: input.admin,
    email: input.email,
    ...(input.roleId === undefined ? {} : { roleId: input.roleId }),
  });
  const link = await input.awaitLink();
  await acceptInvite({
    baseUrl: input.baseUrl,
    email: input.email,
    password: input.password,
    workspaceInviteHash: link.workspaceInviteHash,
  });
  return loginThrowaway({ baseUrl: input.baseUrl, email: input.email, password: input.password });
}

/**
 * The invite link for one email, once the mail has arrived. Specs wait for the mail with expect.poll
 * before calling this, so a missing link here is a test error, not a timing guess.
 */
export async function awaitInviteLink(email: string): Promise<InviteLink> {
  await expect.poll(() => findInviteLink(email)).not.toBeUndefined();
  const link = await findInviteLink(email);
  if (link === undefined) throw new Error("TEST BUG: the invite link disappeared after the poll");
  return link;
}
