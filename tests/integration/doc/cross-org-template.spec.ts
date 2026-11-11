// P5-DOC-AUTHZ-002 cross-organisation template (doc plan 4.2). Organisation A is the owner's personal organisation,
// organisation B is the org-b-member's. Each test creates its own template. Templates are read with GET
// /api/v2/template/{id} and used with POST /api/v2/template/use (vendored contract; templateId is numeric).
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import {
  createTemplate,
  deleteEnvelopeStatus,
  getTemplateStatus,
  legacyTemplateId,
  useTemplateStatus,
} from "../../../src/lanes/doc/envelope-api.ts";

test.describe("P5-DOC-AUTHZ-002", () => {
  test("AUTHZ-002 same-org member reads the template (control)", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const orgB = actorOf(actors, "org-b-member");
    const templateEnv = await createTemplate(orgB.request, base, `${run.prefix}-authz002-own`);
    run.onCleanup(() => deleteEnvelopeStatus(orgB.request, base, templateEnv));
    const id = await legacyTemplateId(orgB.request, base, templateEnv);
    expect(
      await getTemplateStatus(orgB.request, base, id),
      "control: own-org template readable",
    ).toBe(200);
  });

  test("AUTHZ-002 other-org user cannot read the template", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const orgB = actorOf(actors, "org-b-member");
    const templateEnv = await createTemplate(owner.request, base, `${run.prefix}-authz002-read`);
    run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, templateEnv));
    const id = await legacyTemplateId(owner.request, base, templateEnv);
    expect(
      await getTemplateStatus(owner.request, base, id),
      "control: owner reads its template",
    ).toBe(200);
    const status = await getTemplateStatus(orgB.request, base, id);
    expect(
      status,
      "PRODUCT BUG (SUSPECTED) if another organisation read the template",
    ).toBeGreaterThanOrEqual(400);
  });

  test("AUTHZ-002 other-org user cannot create an envelope from the template", async ({
    actors,
    run,
  }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const orgB = actorOf(actors, "org-b-member");
    const templateEnv = await createTemplate(owner.request, base, `${run.prefix}-authz002-use`);
    run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, templateEnv));
    const id = await legacyTemplateId(owner.request, base, templateEnv);
    // Control: the owner can create an envelope from its own template (same request shape, same template).
    const control = await useTemplateStatus(owner.request, base, id);
    expect(control.status, `control: owner uses its template: ${control.detail}`).toBeLessThan(300);
    const status = (await useTemplateStatus(orgB.request, base, id)).status;
    expect(
      status,
      "PRODUCT BUG (SUSPECTED) if another organisation created an envelope",
    ).toBeGreaterThanOrEqual(400);
  });
});
