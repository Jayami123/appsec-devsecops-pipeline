// P5-DOC-NEW-DOC-2 field tampering (doc plan 4.5). Controls first in each test; each test has its own envelope.
// The completed-envelope case completes both recipients with completeDocumentWithToken (recipient-router
// schema.ts:161-171); documentId is parsed from the envelope secondaryId ("document_<n>").
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { deleteEnvelopeStatus, getEnvelopeStatus } from "../../../src/lanes/doc/envelope-api.ts";
import {
  completeWithToken,
  documentIdOf,
  fieldInserted,
  sendTwoSignerEnvelope,
  signFieldWithToken,
} from "../../../src/lanes/doc/signing.ts";

test.describe("P5-DOC-NEW-DOC-2", () => {
  test("NEW-DOC-2 recipient sets own field before completion (control)", async ({
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
      `${run.prefix}-new-doc-2-ctl`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    expect(await fieldInserted(owner.request, base, env.a.fieldId)).toBe(false);
    const signed = await signFieldWithToken(anon, base, env.tokenA, env.a.fieldId, "P5 A");
    expect(signed).toBeGreaterThanOrEqual(200);
    expect(signed).toBeLessThan(300);
    expect(await fieldInserted(owner.request, base, env.a.fieldId), "after: own field set").toBe(
      true,
    );
  });

  test("NEW-DOC-2 recipient cannot set another recipient field", async ({
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
      `${run.prefix}-new-doc-2-neg`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    expect(await fieldInserted(owner.request, base, env.b.fieldId)).toBe(false);
    const refused = await signFieldWithToken(anon, base, env.tokenA, env.b.fieldId, "P5 tamper");
    expect(refused, "PRODUCT BUG (SUSPECTED) if token A set B's field").toBeGreaterThanOrEqual(400);
    expect(
      await fieldInserted(owner.request, base, env.b.fieldId),
      "after: B field unchanged",
    ).toBe(false);
  });

  test("NEW-DOC-2 completed envelope refuses field writes and keeps values", async ({
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
      `${run.prefix}-new-doc-2-done`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    const read = await owner.request.get(
      `${base}/api/v2/envelope/${encodeURIComponent(env.envelopeId)}`,
    );
    const documentId = documentIdOf(((await read.json()) as { secondaryId: string }).secondaryId);
    expect(await signFieldWithToken(anon, base, env.tokenA, env.a.fieldId, "P5 A")).toBeLessThan(
      300,
    );
    expect(await signFieldWithToken(anon, base, env.tokenB, env.b.fieldId, "P5 B")).toBeLessThan(
      300,
    );
    expect(await completeWithToken(anon, base, env.tokenA, documentId)).toBeLessThan(300);
    expect(await completeWithToken(anon, base, env.tokenB, documentId)).toBeLessThan(300);
    expect(await getEnvelopeStatus(owner.request, base, env.envelopeId)).toBe(200);
    const refused = await signFieldWithToken(anon, base, env.tokenA, env.a.fieldId, "P5 changed");
    expect(
      refused,
      "PRODUCT BUG (SUSPECTED) if a completed envelope accepted a field write",
    ).toBeGreaterThanOrEqual(400);
    expect(
      await fieldInserted(owner.request, base, env.a.fieldId),
      "value kept after refusal",
    ).toBe(true);
  });
});
