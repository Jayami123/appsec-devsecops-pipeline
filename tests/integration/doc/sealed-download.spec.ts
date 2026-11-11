// P5-DOC-NEW-DOC-5 sealed document download (doc plan 4.5). Both recipients sign and complete, then the owner
// downloads the signed item (GET /api/v2/envelope/item/{envelopeItemId}/download, version "signed": OAS enum).
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { deleteEnvelopeStatus } from "../../../src/lanes/doc/envelope-api.ts";
import {
  completeWithToken,
  documentIdOf,
  sendTwoSignerEnvelope,
  signFieldWithToken,
} from "../../../src/lanes/doc/signing.ts";

test.describe("P5-DOC-NEW-DOC-5", () => {
  test("NEW-DOC-5 owner downloads the sealed document (control)", async ({
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
      `${run.prefix}-new-doc-5`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    const read = await owner.request.get(
      `${base}/api/v2/envelope/${encodeURIComponent(env.envelopeId)}`,
    );
    const body = (await read.json()) as { secondaryId: string; envelopeItems: { id: string }[] };
    const documentId = documentIdOf(body.secondaryId);
    const itemId = body.envelopeItems[0]?.id ?? "";
    expect(itemId.length, "envelope item id").toBeGreaterThan(0);
    expect(await signFieldWithToken(anon, base, env.tokenA, env.a.fieldId)).toBeLessThan(300);
    expect(await signFieldWithToken(anon, base, env.tokenB, env.b.fieldId)).toBeLessThan(300);
    expect(await completeWithToken(anon, base, env.tokenA, documentId)).toBeLessThan(300);
    expect(await completeWithToken(anon, base, env.tokenB, documentId)).toBeLessThan(300);
    const control = await owner.request.get(
      `${base}/api/v2/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`,
    );
    expect(control.status()).toBe(200);
    expect((await control.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("NEW-DOC-5 non-recipient cannot download the sealed document", async ({
    actors,
    run,
    playwright,
  }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const other = actorOf(actors, "other");
    const anon = await playwright.request.newContext();
    run.onCleanup(() => anon.dispose());
    const env = await sendTwoSignerEnvelope(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-new-doc-5-neg`,
      (id) => {
        run.onCleanup(() => deleteEnvelopeStatus(owner.request, base, id));
      },
    );
    const read = await owner.request.get(
      `${base}/api/v2/envelope/${encodeURIComponent(env.envelopeId)}`,
    );
    const body = (await read.json()) as { secondaryId: string; envelopeItems: { id: string }[] };
    const documentId = documentIdOf(body.secondaryId);
    const itemId = body.envelopeItems[0]?.id ?? "";
    expect(await signFieldWithToken(anon, base, env.tokenA, env.a.fieldId)).toBeLessThan(300);
    expect(await signFieldWithToken(anon, base, env.tokenB, env.b.fieldId)).toBeLessThan(300);
    expect(await completeWithToken(anon, base, env.tokenA, documentId)).toBeLessThan(300);
    expect(await completeWithToken(anon, base, env.tokenB, documentId)).toBeLessThan(300);
    // Control for the non-recipient: the owner downloads the same item in this test as well.
    expect(
      (
        await owner.request.get(
          `${base}/api/v2/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`,
        )
      ).status(),
    ).toBe(200);
    const res = await other.request.get(
      `${base}/api/v2/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`,
    );
    const bytes = await res.body();
    const leaked =
      res.status() >= 200 &&
      res.status() < 300 &&
      bytes.subarray(0, 5).toString("latin1") === "%PDF-";
    expect(leaked, "PRODUCT BUG (SUSPECTED): a non-recipient received the sealed PDF").toBe(false);
    expect([401, 403, 404]).toContain(res.status());
  });
});
