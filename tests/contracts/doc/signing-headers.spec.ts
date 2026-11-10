// P5-DOC-HDR-001 (P2): the signing page headers. Oracle taken from the pinned middleware (doc plan section 4.4,
// correction C9): /sign/:token is a "frameable" path (security-headers.ts:46, :123-124), so it gets the CSP with
// `frame-ancestors *` (:109-112). Referrer-Policy and X-Content-Type-Options are set only for "embed" paths
// (:170-178), so their absence on /sign is by design and is recorded, not reported as a defect (D-DOC-B22).
import type { APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { extractFirstLink, latestMessageBodyFor } from "../../../src/lanes/doc/inbucket.ts";
import {
  addSigner,
  createEnvelope,
  deleteEnvelopeStatus,
  distributeEnvelope,
} from "../../../src/lanes/doc/envelope-api.ts";
import type { CleanupStep } from "../../../src/kit/shared/cleanup.ts";

/** Polls the signer mailbox (expect.poll; the deadline is the configured expect timeout) for the /sign/ link. */
async function waitForSigningLink(
  request: APIRequestContext,
  signer: string,
  prefix: string,
): Promise<string> {
  let found = "";
  await expect
    .poll(
      async () => {
        const body = await latestMessageBodyFor(request, signer, prefix);
        const link = body === null ? null : extractFirstLink(body, "/sign/");
        found = link ?? "";
        return link;
      },
      { message: "signing mail" },
    )
    .toBeTruthy();
  return found;
}

/** Creates an envelope, sends it to one fresh signer and returns the signing path read from the mail. */
async function sentSigningPath(
  request: APIRequestContext,
  base: string,
  prefix: string,
  title: string,
  onCleanup: (step: CleanupStep) => void,
): Promise<string> {
  const envelopeId = await createEnvelope(request, base, title);
  onCleanup(() => deleteEnvelopeStatus(request, base, envelopeId));
  const signer = `${prefix}-hdr001-${randomBytes(4).toString("hex")}@p5.test`;
  expect(await addSigner(request, base, envelopeId, signer, "P5 signer"), "add signer").toBe(200);
  expect(await distributeEnvelope(request, base, envelopeId), "distribute").toBe(200);
  const link = await waitForSigningLink(request, signer, prefix);
  return new URL(link).pathname;
}

test.describe("P5-DOC-HDR-001", () => {
  test("HDR-001 signing page returns 200 for a valid token (control)", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const path = await sentSigningPath(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-hdr001`,
      (step) => {
        run.onCleanup(step);
      },
    );
    const res = await owner.request.get(`${base}${path}`, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  test("HDR-001 signing page sends the frame and content security policy", async ({
    actors,
    run,
  }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const path = await sentSigningPath(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-hdr001-csp`,
      (step) => {
        run.onCleanup(step);
      },
    );
    const res = await owner.request.get(`${base}${path}`, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-security-policy"], "CSP header present").toBeDefined();
    // Observation, not a defect: Referrer-Policy and nosniff are embed-only (security-headers.ts:170-178).
    test.info().annotations.push({
      type: "embed-only-headers",
      description: `referrer-policy=${res.headers()["referrer-policy"] ?? "absent"} nosniff=${res.headers()["x-content-type-options"] ?? "absent"}`,
    });
  });

  test("HDR-001 signing page frame rule is the documented wildcard", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const path = await sentSigningPath(
      owner.request,
      base,
      run.prefix,
      `${run.prefix}-hdr001-frame`,
      (step) => {
        run.onCleanup(step);
      },
    );
    const res = await owner.request.get(`${base}${path}`, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    // Design verdict (security-headers.ts:26-28, :109-112): frame-ancestors * on the signing route.
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors *");
  });
});
