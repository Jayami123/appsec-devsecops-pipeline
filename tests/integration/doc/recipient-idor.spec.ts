// P5-DOC-NEW-DOC-1 recipient-token IDOR (doc plan 4.5). Two recipients on one envelope, each with a NAME field.
// Token A is used anonymously (a fresh request context with no owner cookie). Controls run first in each test.
// Field and token calls: tRPC envelope.field.sign (sign-envelope-field.types.ts:50-55); the field inserted flag from
// GET /api/v2/envelope/field/{fieldId}. The tRPC wire format is UNVERIFIED until the first live run.
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { deleteEnvelopeStatus } from "../../../src/lanes/doc/envelope-api.ts";
import {
  fieldInserted,
  sendTwoSignerEnvelope,
  signFieldWithToken,
} from "../../../src/lanes/doc/signing.ts";

test.describe("P5-DOC-NEW-DOC-1", () => {
  test("NEW-DOC-1 token A reads its own signing page (control)", async ({
    actors,
    run,
    playwright,
  }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const anon = await playwright.request.newContext();
    run.onCleanup(() => anon.dispose());
    const env = await sendTwoSignerEnvelope(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-new-doc-1`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    const page = await anon.get(`${base}/sign/${env.tokenA}`, { maxRedirects: 0 });
    expect(page.status(), "control: own signing page").toBe(200);
    const signed = await signFieldWithToken(anon, base, env.tokenA, env.a.fieldId);
    expect(signed, "control: token A signs its own field").toBeGreaterThanOrEqual(200);
    expect(signed).toBeLessThan(300);
  });

  test("NEW-DOC-1 token A cannot read recipient B fields", async ({ actors, run, playwright }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const anon = await playwright.request.newContext();
    run.onCleanup(() => anon.dispose());
    const env = await sendTwoSignerEnvelope(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-new-doc-1-read`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    const page = await anon.get(`${base}/sign/${env.tokenA}`, { maxRedirects: 0 });
    const body = await page.text();
    // Oracle: the page held by token A must not disclose recipient B's address or field id.
    expect(body, "PRODUCT BUG (SUSPECTED) if token A's page discloses recipient B").not.toContain(
      env.b.email,
    );
    expect(body).not.toContain(`"fieldId":${env.b.fieldId}`);
  });

  test("NEW-DOC-1 token A cannot sign as recipient B and B state is unchanged", async ({
    actors,
    run,
    playwright,
  }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const anon = await playwright.request.newContext();
    run.onCleanup(() => anon.dispose());
    const env = await sendTwoSignerEnvelope(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-new-doc-1-sign`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    // Before state. The negative's valid control is test 1 (a token signs its own field, same primitive).
    expect(await fieldInserted(owner.request, base, env.b.fieldId), "before: B field empty").toBe(
      false,
    );
    const refused = await signFieldWithToken(anon, base, env.tokenA, env.b.fieldId);
    expect(refused, "PRODUCT BUG (SUSPECTED) if token A signed B's field").toBeGreaterThanOrEqual(
      400,
    );
    expect(
      await fieldInserted(owner.request, base, env.b.fieldId),
      "after: B field unchanged",
    ).toBe(false);
  });
});
