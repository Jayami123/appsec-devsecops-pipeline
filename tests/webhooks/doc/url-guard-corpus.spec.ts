// P5-DOC-PN-1 webhook URL guard, CREATE TIME ONLY (D-DOC-B7; doc plan section 4.6). The delivery leg is gated on
// the owner canary (O-3) and is NOT built here. Create refusal: fork ref held by the owner (message at :10) in the fork at
// f4105e47. Procedures: webhook.createWebhook and webhook.deleteWebhook over tRPC (authenticated: the session
// cookie is the credential). UNVERIFIED wire shape: the tRPC data transformer (fork ref held by the owner
// fork ref held by the owner) is assumed to take the superjson `json` wrapper; the first live run is the check.
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { PUBLIC_CONTROL_URL, URL_GUARD_CORPUS } from "../../../src/lanes/doc/url-guard-corpus.ts";

const REFUSAL = "Webhook URL cannot point to a private or loopback address";
const TRPC = "/api/trpc";

async function createWebhook(
  request: import("@playwright/test").APIRequestContext,
  base: string,
  url: string,
) {
  return request.post(`${base}${TRPC}/webhook.createWebhook`, {
    data: {
      json: { webhookUrl: url, eventTriggers: ["DOCUMENT_SENT"], secret: null, enabled: true },
    },
  });
}

test.describe("P5-DOC-PN-1", () => {
  test("PN-1 public literal is accepted at create time (control)", async ({ actors, run }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    const res = await createWebhook(owner.request, base, PUBLIC_CONTROL_URL);
    expect(res.status(), "control: public literal accepted").toBe(200);
    const body = (await res.json()) as { result?: { data?: { json?: { id?: string } } } };
    const id = body.result?.data?.json?.id ?? "";
    expect(id.length, "control webhook id returned").toBeGreaterThan(0);
    run.onCleanup(async () => {
      await owner.request.post(`${base}${TRPC}/webhook.deleteWebhook`, { data: { json: { id } } });
    });
  });

  test("PN-1 corpus refuses loopback and private literals at create time", async ({ actors }) => {
    const base = apiBaseUrl("documenso");
    const owner = actorOf(actors, "owner");
    for (const entry of URL_GUARD_CORPUS) {
      const res = await createWebhook(owner.request, base, entry.url);
      const text = await res.text();
      // An accepted entry is PRODUCT BUG (SUSPECTED). The URL and status are the only detail reported.
      expect(
        res.status(),
        `PRODUCT BUG (SUSPECTED) if accepted: ${entry.id} (${entry.url}) status`,
      ).toBeGreaterThanOrEqual(400);
      expect(text, `refusal message for ${entry.id}`).toContain(REFUSAL);
    }
  });
});
