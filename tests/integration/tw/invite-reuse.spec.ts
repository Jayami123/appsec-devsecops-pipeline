// NEW-TW-5 reuse (tw-api). An invite is sent to a throwaway invitee and accepted once (control, joins
// the workspace). The second accept with the same invite hash must be refused, with the membership
// unchanged. Observed on the live stack: the second accept with the same correct password succeeded
// (re-authentication, no membership change); a different password was refused and the original
// password still works, so no takeover was observed. The planned oracle (refused) is asserted as written.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import {
  adminSetupSession,
  throwawayEmail,
  throwawayPassword,
} from "../../../src/lanes/tw/login.ts";
import { acceptInvite, sendInvite } from "../../../src/lanes/tw/invite.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { awaitInviteLink, joinWorkspace } from "../../../src/lanes/tw/member.ts";
import {
  assertLoopbackRecipeName,
  seededPair,
  findInviteHash,
  memberIdsByEmail,
  recipeRootUrl,
} from "./multiws-support.ts";

test("NEW-TW-5: an invite token cannot be accepted twice", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const email = throwawayEmail(run.prefix, "reuse");
  const password = throwawayPassword();
  const awaitLink = () => awaitInviteLink(email);
  await joinWorkspace({ baseUrl: base, admin, email, password, awaitLink }); // control: first accept
  const link = await awaitLink();

  let refused = false;
  let message = "";
  try {
    await acceptInvite({
      baseUrl: base,
      email,
      password,
      workspaceInviteHash: link.workspaceInviteHash,
    });
  } catch (error) {
    refused = true;
    message = error instanceof Error ? error.message.slice(0, 120) : "unknown";
  }
  // PRODUCT BUG (SUSPECTED), marked before the unchanged assertion (owner decision 2). Fork: the invite
  // path is auth.resolver.ts:523-532 (signUpInWorkspace, metadata). Live: the second accept with the same
  // correct password returned success; a different password was refused (no takeover observed).
  expectedDefect(
    "NEW-TW-5: second accept of one invite hash succeeds for the same member. Fork: auth.resolver.ts:523-532 (signUpInWorkspace). Live (tw-api run): same password accepted, different password refused, membership unchanged.",
  );
  expect(refused, `the second accept is refused (${message || "accepted"})`).toBe(true);
});

// NEW-TW-5 cross-workspace half (tw-multiws, D-TW-B46). An invite issued by workspace A is accepted by a user of
// workspace B. Setup (asserted first): the recipe is on the stack and lvh.me resolves to loopback. Owner A and owner
// B are throwaway owners of their own workspaces; the invitee is a throwaway email the owner of A invites to A.
// Control: the invitee accepts A's invite on A's origin (membership of A is created).
// Negative: the owner of B (a user of workspace B, with its own email and password) presents A's invite hash on B's
// origin. Oracle: refused, and B's owner is not a member of A (membership list of A read before and after).
test("NEW-TW-5 (cross-workspace): a workspace B user cannot accept a workspace A invite @multiws", async ({
  run,
}) => {
  const root = recipeRootUrl(); // setup: ENV failure stops here, before any product call
  await assertLoopbackRecipeName(root.hostname);
  const { a, b } = await seededPair({ root, prefix: run.prefix, label: "nt5" });
  const invitee = throwawayEmail(run.prefix, "nt5invitee");
  const inviteePassword = throwawayPassword();

  await sendInvite({ baseUrl: a.origin, admin: a.admin, email: invitee });
  await expect.poll(() => findInviteHash(invitee)).not.toBeUndefined(); // the invite mail arrives
  const hash = await findInviteHash(invitee);
  if (hash === undefined) throw new Error("TEST BUG: the invite hash disappeared after the poll");

  // control: the invitee accepts A's invite on A's origin
  await acceptInvite({
    baseUrl: a.origin,
    email: invitee,
    password: inviteePassword,
    workspaceInviteHash: hash,
  });
  const controlMembers = await memberIdsByEmail({
    origin: a.origin,
    session: a.admin,
    email: invitee,
  });
  expect(controlMembers.length, "control: the invitee is a member of A").toBe(1);

  // negative: B's owner presents A's invite hash on B's origin
  const membersBefore = await memberIdsByEmail({
    origin: a.origin,
    session: a.admin,
    email: b.email,
  });
  let refused = false;
  let message = "";
  try {
    await acceptInvite({
      baseUrl: b.origin,
      email: b.email,
      password: b.password,
      workspaceInviteHash: hash,
    });
  } catch (error) {
    refused = true;
    message = error instanceof Error ? error.message.slice(0, 120) : "unknown";
  }
  expect(refused, `negative: B's user cannot accept A's invite (${message || "accepted"})`).toBe(
    true,
  );
  const membersAfter = await memberIdsByEmail({
    origin: a.origin,
    session: a.admin,
    email: b.email,
  });
  expect(membersAfter, "negative: B's user is not a member of A").toEqual(membersBefore);
  expect(membersAfter.length, "negative: B's user is not a member of A").toBe(0);
});
