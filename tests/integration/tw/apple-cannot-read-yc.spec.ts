// P5-TW-MT-001 (tw-multiws, D-TW-B46). A user of a second workspace cannot read a company of the first workspace.
// Setup (asserted first): the README recipe is on the stack and lvh.me resolves to loopback. Two throwaway owners each
// create their own workspace through the product; the first (A) creates a company with the run prefix in its name.
// Control: A's own session reads the company on A's origin: 200 and the same id.
// Negative: B's session presents the same company id on A's origin (B's user reaching A's workspace): refused (4xx),
// and the body carries no value of the company.
// Oracle: refused, and the company name is absent from the body.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import {
  assertLoopbackRecipeName,
  createCompany,
  createOwnedWorkspace,
  readRest,
  recipeRootUrl,
} from "./multiws-support.ts";

test("P5-TW-MT-001: a user of a second workspace cannot read a company of the first @multiws", async ({
  run,
}) => {
  const root = recipeRootUrl(); // setup: ENV failure stops here, before any product call
  await assertLoopbackRecipeName(root.hostname);
  const a = await createOwnedWorkspace({ root, prefix: run.prefix, label: "mt1a" });
  const b = await createOwnedWorkspace({ root, prefix: run.prefix, label: "mt1b" });
  const name = `${run.prefix}-mt001-company`;
  const companyId = await createCompany({ origin: a.origin, session: a.session, name });

  // control: the owner of A reads A's company on A's origin
  const control = await readRest({
    url: `${a.origin}/rest/companies/${companyId}`,
    bearer: a.session.accessToken,
  });
  expect(control.status, "control: A reads its own company").toBe(200);
  expect(control.text, "control: the id matches").toContain(companyId);

  // negative: B's session on A's origin
  const negative = await readRest({
    url: `${a.origin}/rest/companies/${companyId}`,
    bearer: b.session.accessToken,
  });
  expect([400, 401, 403, 404], `negative: B is refused (HTTP ${negative.status})`).toContain(
    negative.status,
  );
  expect(negative.text.includes(name), "negative: no company value in the body").toBe(false);
});
