// P5-DOC-NEW-DOC-5 sealed document download (doc plan 4.5). Both recipients sign and complete, then the owner
// downloads the signed item (GET /api/v2/envelope/item/{envelopeItemId}/download?version=signed). This route
// authenticates with an API token in the Authorization header only (download.ts:26-42; D-DOC-B52), so each actor
// mints its own token for its personal team and revokes it in cleanup. Tokens are sent per request and never logged
// (call-log.ts masks them in any error).
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { deleteEnvelopeStatus } from "../../../src/lanes/doc/envelope-api.ts";
import {
  mintApiToken,
  revokeApiToken,
  type MintedToken,
} from "../../../src/lanes/doc/api-token.ts";
import {
  completeWithToken,
  documentIdOf,
  sendTwoSignerEnvelope,
  signFieldWithToken,
} from "../../../src/lanes/doc/signing.ts";
import type { APIRequestContext } from "@playwright/test";

function downloadUrl(base: string, itemId: string): string {
  return `${base}/api/v2/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`;
}

async function download(request: APIRequestContext, url: string, token: MintedToken) {
  return request.get(url, { headers: { authorization: token.token } });
}

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
    const token = await mintApiToken(
      owner.request,
      base,
      owner.teamId,
      `P5 download ${run.prefix}`,
    );
    run.onCleanup(() => revokeApiToken(owner.request, base, owner.teamId, token.id));
    const control = await download(owner.request, downloadUrl(base, itemId), token);
    expect(control.status(), "control: owner downloads the signed item").toBe(200);
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
    const ownerToken = await mintApiToken(
      owner.request,
      base,
      owner.teamId,
      `P5 owner ${run.prefix}`,
    );
    run.onCleanup(() => revokeApiToken(owner.request, base, owner.teamId, ownerToken.id));
    const otherToken = await mintApiToken(
      other.request,
      base,
      other.teamId,
      `P5 other ${run.prefix}`,
    );
    run.onCleanup(() => revokeApiToken(other.request, base, other.teamId, otherToken.id));
    // Control for the non-recipient: the owner downloads the same item in this test as well.
    expect(
      (await download(owner.request, downloadUrl(base, itemId), ownerToken)).status(),
      "control: owner",
    ).toBe(200);
    const res = await download(other.request, downloadUrl(base, itemId), otherToken);
    const bytes = await res.body();
    const leaked =
      res.status() >= 200 &&
      res.status() < 300 &&
      bytes.subarray(0, 5).toString("latin1") === "%PDF-";
    expect(leaked, "PRODUCT BUG (SUSPECTED): a non-recipient received the sealed PDF").toBe(false);
    expect([401, 403, 404]).toContain(res.status());
  });
});
