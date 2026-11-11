// Throwaway admin through the invite route (owner decision D-MED-6). Used by RL-001 and RBAC-001 only.
// The admin is created under the run prefix and deleted in the run scope's cleanup. Never a seed user.
import { randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";
import type { AdminSession } from "./admin-session.ts";
import type { RunScope } from "./run-fixture.ts";

export interface ThrowawayAdmin {
  readonly email: string;
  readonly password: string;
  readonly userId: string;
}

const base = () => apiBaseUrl("medusa");

/** Invite, register and accept. Returns the credentials used by the caller; cleanup is registered on the run scope. */
export async function createThrowawayAdminUser(
  api: APIRequestContext,
  admin: AdminSession,
  run: RunScope,
  label: string,
): Promise<ThrowawayAdmin> {
  const email = `${run.prefix}-${label}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const invited = await api.fetch(`${base()}/admin/invites`, {
    method: "POST",
    headers: { authorization: admin.authorization, "content-type": "application/json" },
    data: { email },
  });
  if (invited.status() !== 200) throw new Error(`invite failed: HTTP ${invited.status()}`);
  const invite = ((await invited.json()) as { invite?: { id?: string; token?: string } }).invite;
  if (!invite?.token || !invite.id)
    throw new Error("invite: no token in the create response (ENV or design)");
  run.onCleanup(async () => {
    const r = await api.fetch(`${base()}/admin/invites/${invite.id}`, {
      method: "DELETE",
      headers: { authorization: admin.authorization },
    });
    if (r.status() !== 200) throw new Error(`delete invite failed: HTTP ${r.status()}`);
  });

  const registered = await api.fetch(`${base()}/auth/user/emailpass/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    data: { email, password },
  });
  if (registered.status() !== 200)
    throw new Error(`register identity failed: HTTP ${registered.status()}`);
  const registrationToken = ((await registered.json()) as { token?: string }).token;
  if (!registrationToken) throw new Error("register identity: no token");

  const accepted = await api.fetch(
    `${base()}/admin/invites/accept?token=${encodeURIComponent(invite.token)}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${registrationToken}`, "content-type": "application/json" },
      data: { first_name: "P5", last_name: label },
    },
  );
  if (accepted.status() !== 200) throw new Error(`accept invite failed: HTTP ${accepted.status()}`);
  const userId = ((await accepted.json()) as { user?: { id?: string } }).user?.id;
  if (!userId) throw new Error("accept invite: no user id");
  run.onCleanup(async () => {
    const r = await api.fetch(`${base()}/admin/users/${userId}`, {
      method: "DELETE",
      headers: { authorization: admin.authorization },
    });
    if (r.status() !== 200) throw new Error(`delete throwaway admin failed: HTTP ${r.status()}`);
  });
  return { email, password, userId };
}
