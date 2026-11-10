// P5-DOC-AUTHZ-001 (P0): another user cannot GET or DELETE an envelope they do not own (doc plan section 4.1).
// Envelope routes: /api/v2/envelope/create, /envelope/{id}, /envelope/delete (vendored contract). Each test
// creates its own envelopes (independent fixtures) and registers their cleanup and leak probes.
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { assertCovered, type MatrixRow } from "../../../src/security/matrix.ts";
import {
  createEnvelope,
  deleteEnvelopeStatus,
  getEnvelopeStatus,
} from "../../../src/lanes/doc/envelope-api.ts";

const rows: MatrixRow[] = [];
const ABSENT = [401, 403, 404];

test.describe("P5-DOC-AUTHZ-001", () => {
  test("AUTHZ-001 owner can GET and DELETE own envelope (control)", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const getId = await createEnvelope(owner.request, base, `${run.prefix}-authz001-get`);
    const delId = await createEnvelope(owner.request, base, `${run.prefix}-authz001-del-ctl`);
    run.onCleanup(async () => {
      await deleteEnvelopeStatus(owner.request, base, getId);
    });
    run.trackLeak({
      label: "envelope get",
      stillPresent: async () => (await getEnvelopeStatus(owner.request, base, getId)) === 200,
    });
    expect(await getEnvelopeStatus(owner.request, base, getId)).toBe(200);
    rows.push({
      actor: "owner",
      resource: "envelope",
      verb: "GET",
      expected: "allow",
      caseId: "P5-DOC-AUTHZ-001",
    });

    expect(await deleteEnvelopeStatus(owner.request, base, delId)).toBe(200);
    expect(await getEnvelopeStatus(owner.request, base, delId), "after state: deleted").toBe(404);
    rows.push({
      actor: "owner",
      resource: "envelope",
      verb: "DELETE",
      expected: "allow",
      caseId: "P5-DOC-AUTHZ-001",
    });
  });

  test("AUTHZ-001 other user cannot GET the owner envelope", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const other = actorOf(actors, "other");
    const ownerId = await createEnvelope(owner.request, base, `${run.prefix}-authz001-neg-get`);
    run.onCleanup(async () => {
      await deleteEnvelopeStatus(owner.request, base, ownerId);
    });
    run.trackLeak({
      label: "envelope neg-get",
      stillPresent: async () => (await getEnvelopeStatus(owner.request, base, ownerId)) === 200,
    });
    // Control for the other actor: its own envelope is readable (same actor class, same resource).
    const otherId = await createEnvelope(other.request, base, `${run.prefix}-authz001-other-own`);
    run.onCleanup(async () => {
      await deleteEnvelopeStatus(other.request, base, otherId);
    });
    run.trackLeak({
      label: "envelope other-own",
      stillPresent: async () => (await getEnvelopeStatus(other.request, base, otherId)) === 200,
    });
    expect(await getEnvelopeStatus(other.request, base, otherId)).toBe(200);
    rows.push({
      actor: "other",
      resource: "envelope",
      verb: "GET",
      expected: "allow",
      caseId: "P5-DOC-AUTHZ-001",
    });

    // Negative: the owner's envelope must not be readable by the other user.
    expect(ABSENT).toContain(await getEnvelopeStatus(other.request, base, ownerId));
    rows.push({
      actor: "other",
      resource: "envelope",
      verb: "GET",
      expected: "deny-4xx",
      caseId: "P5-DOC-AUTHZ-001",
    });
    // After state: the owner still reads the envelope unchanged.
    expect(await getEnvelopeStatus(owner.request, base, ownerId)).toBe(200);
  });

  test("AUTHZ-001 other user cannot DELETE the owner envelope and it stays live", async ({
    actors,
    run,
  }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const other = actorOf(actors, "other");
    const delNeg = await createEnvelope(owner.request, base, `${run.prefix}-authz001-neg-del`);
    run.onCleanup(async () => {
      await deleteEnvelopeStatus(owner.request, base, delNeg);
    });
    run.trackLeak({
      label: "envelope neg-del",
      stillPresent: async () => (await getEnvelopeStatus(owner.request, base, delNeg)) === 200,
    });
    // Before state: owner reads it (2xx).
    expect(await getEnvelopeStatus(owner.request, base, delNeg)).toBe(200);
    // Negative: the other user's DELETE is refused (any non-2xx).
    const refused = await deleteEnvelopeStatus(other.request, base, delNeg);
    expect(refused, "other user DELETE must not succeed").toBeGreaterThanOrEqual(400);
    // After state: the owner still sees the envelope.
    expect(await getEnvelopeStatus(owner.request, base, delNeg), "envelope stays live").toBe(200);
    rows.push({
      actor: "other",
      resource: "envelope",
      verb: "DELETE",
      expected: "deny-4xx",
      caseId: "P5-DOC-AUTHZ-001",
    });
    assertCovered(rows, ["owner", "other"], ["envelope"], ["GET", "DELETE"]);
  });
});
