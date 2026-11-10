// NEW-TW-6 (tw-serial; D-TW-B10). A throwaway member M is invited as Admin (control: M's update of a
// company is 2xx and persisted). Each trial restores Admin, then sends the demotion of M
// (updateWorkspaceMemberRole, role.resolver.ts:107) and M's update of the same company together. The
// per-trial oracle: 2xx and persisted, or 4xx and unchanged, never 5xx. Deterministic sub-check: after the
// demotion response, M's next update is sent alone and must be refused and not persisted.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import {
  adminSetupSession,
  loginThrowaway,
  throwawayEmail,
  throwawayPassword,
} from "../../../src/lanes/tw/login.ts";
import { acceptInvite, sendInvite } from "../../../src/lanes/tw/invite.ts";
import { awaitInviteLink } from "../../../src/lanes/tw/member.ts";
import { gql } from "../../../src/lanes/tw/gql.ts";
import { roleIdByLabel } from "../../../src/lanes/tw/keys.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";

test("NEW-TW-6: a demoted member's concurrent update is 2xx-and-persisted or 4xx-and-unchanged, never 5xx", async ({
  run,
}, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const adminRole = await roleIdByLabel({ baseUrl: base, session: admin, label: "Admin" });
  const restricted = await roleIdByLabel({
    baseUrl: base,
    session: admin,
    label: "Object-restricted",
  });
  if (adminRole === undefined || restricted === undefined)
    throw new Error("TEST BUG: roles missing");

  const email = throwawayEmail(run.prefix, "race");
  const password = throwawayPassword();
  await sendInvite({ baseUrl: base, admin, email, roleId: adminRole });
  const link = await awaitInviteLink(email);
  await acceptInvite({
    baseUrl: base,
    email,
    password,
    workspaceInviteHash: link.workspaceInviteHash,
  });
  const member = await loginThrowaway({ baseUrl: base, email, password });

  // Filter by the member's email: a plain list is paged, and the harness stack keeps earlier rows (TEST BUG fixed).
  const memberWorkspaceId = await (async () => {
    const response = await fetch(
      `${base}/rest/workspaceMembers?limit=1&filter=userEmail[eq]:${encodeURIComponent(email)}`,
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    const body = (await response.json()) as {
      data?: { workspaceMembers?: Array<{ id: string; userEmail: string }> };
    };
    return body.data?.workspaceMembers?.find((row) => row.userEmail === email)?.id;
  })();
  if (memberWorkspaceId === undefined)
    throw new Error("TEST BUG: the member's workspace member id was not found");

  const company = (await (
    await fetch(`${base}/rest/companies`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ name: `${run.prefix}-race-start` }),
    })
  ).json()) as { data: { createCompany: { id: string } } };
  const companyId = company.data.createCompany.id;
  run.onCleanup(async () => {
    await fetch(`${base}/rest/companies/${companyId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
  });

  const setRole = (roleId: string) =>
    gql<unknown>({
      baseUrl: base,
      endpoint: "metadata",
      bearer: admin.accessToken,
      operation: "updateWorkspaceMemberRole",
      query: `mutation R($workspaceMemberId: UUID!, $roleId: UUID!) { updateWorkspaceMemberRole(workspaceMemberId: $workspaceMemberId, roleId: $roleId) { id } }`,
      variables: { workspaceMemberId: memberWorkspaceId, roleId },
    });
  const update = (name: string) =>
    fetch(`${base}/rest/companies/${companyId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${member.accessToken}`,
      },
      body: JSON.stringify({ name }),
    });
  const readName = async () =>
    (
      (await (
        await fetch(`${base}/rest/companies/${companyId}`, {
          headers: { authorization: `Bearer ${admin.accessToken}` },
        })
      ).json()) as {
        data: { company: { name: string } };
      }
    ).data.company.name;

  await setRole(adminRole);
  const control = await update(`${run.prefix}-race-control`);
  expect(control.status, "control: the admin member's update is 2xx").toBeLessThan(300);
  expect(await readName(), "control: the update is persisted").toBe(`${run.prefix}-race-control`);

  const outcomes: string[] = [];
  for (let trial = 0; trial < BUDGETS.TW_DEMOTE_RACE_TRIALS.value; trial += 1) {
    await setRole(adminRole);
    const before = await readName();
    const wanted = `${run.prefix}-race-${trial}`;
    const [demotion, racing] = await Promise.all([
      setRole(restricted).then(
        () => "ok",
        (e: unknown) => `ERR ${e instanceof Error ? e.message.slice(0, 60) : "unknown"}`,
      ),
      update(wanted),
    ]);
    expect(demotion, "the demotion is applied").toBe("ok");
    const after = await readName();
    if (racing.status >= 500) outcomes.push(`trial ${trial}: 5xx`);
    else if (racing.status < 300 && after === wanted)
      outcomes.push(`trial ${trial}: 2xx persisted`);
    else if (racing.status >= 400 && racing.status < 500 && after === before)
      outcomes.push(`trial ${trial}: 4xx unchanged`);
    else outcomes.push(`trial ${trial}: inconsistent status=${racing.status}`);
  }
  testInfo.annotations.push({ type: "race", description: outcomes.join("; ") });
  expect(
    outcomes.filter((row) => /5xx|inconsistent/.test(row)),
    "no trial returned 5xx or an inconsistent state",
  ).toEqual([]);

  // Deterministic sub-check: after the demotion response, the next update is sent alone and refused.
  await setRole(restricted);
  const beforeSequential = await readName();
  const sequential = await update(`${run.prefix}-after-demotion`);
  expect(
    sequential.status >= 400 && sequential.status < 500,
    "the post-demotion update is refused",
  ).toBe(true);
  expect(await readName(), "the post-demotion update is not persisted").toBe(beforeSequential);
  await setRole(adminRole);
});
