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
import { acceptInvite } from "../../../src/lanes/tw/invite.ts";
import { awaitInviteLink, joinWorkspace } from "../../../src/lanes/tw/member.ts";

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
  expect(refused, `the second accept is refused (${message || "accepted"})`).toBe(true);
});
