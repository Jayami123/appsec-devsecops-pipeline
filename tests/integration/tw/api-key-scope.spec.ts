// NEW-TW-2 case (b) (tw-api). A key K_A is created in the workspace (api-key.resolver.ts:79), creates a
// webhook (control, POST /rest/webhooks 201), is revoked and read back, and its next create is refused
// with the webhook list unchanged. Case (a), a key used on a second workspace, is tw-multiws and is not
// built in this PR (see the PR body).
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { createApiKey, revokeApiKey } from "../../../src/lanes/tw/keys.ts";
import { gql } from "../../../src/lanes/tw/gql.ts";

const HOOK = { targetUrl: "http://127.0.0.1:9/p5-scope", operations: ["company.created"] };

async function webhookIds(base: string, bearer: string): Promise<string[]> {
  const response = await fetch(`${base}/rest/webhooks?limit=200`, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  const body: unknown = await response.json();
  return Array.isArray(body) ? (body as Array<{ id: string }>).map((hook) => hook.id) : [];
}

test("NEW-TW-2: a revoked API key cannot create a webhook", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const key = await createApiKey({ baseUrl: base, session: admin, name: `${run.prefix}-scope` });
  let revoked = false;
  const createdHooks: string[] = [];
  run.onCleanup(async () => {
    for (const id of createdHooks) {
      await fetch(`${base}/rest/webhooks/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });
    }
  });
  run.onCleanup(async () => {
    if (!revoked) await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  });

  const control = await fetch(`${base}/rest/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key.secret}` },
    body: JSON.stringify(HOOK),
  });
  expect(control.status, "control: the live key creates a webhook").toBe(201);
  createdHooks.push(((await control.json()) as { id: string }).id);

  await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  revoked = true;
  const evidence = await gql<{ apiKey: { revokedAt: string | null } | null }>({
    baseUrl: base,
    endpoint: "metadata",
    bearer: admin.accessToken,
    operation: "apiKey",
    query: `query K($input: GetApiKeyInput!) { apiKey(input: $input) { revokedAt } }`,
    variables: { input: { id: key.id } },
  });
  expect(evidence.apiKey?.revokedAt, "revocation is evidenced by a read").not.toBeNull();

  const before = await webhookIds(base, admin.accessToken);
  const negative = await fetch(`${base}/rest/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key.secret}` },
    body: JSON.stringify({ ...HOOK, targetUrl: "http://127.0.0.1:9/p5-scope-revoked" }),
  });
  expect([401, 403, 400], "the revoked key create is refused").toContain(negative.status);
  expect(await webhookIds(base, admin.accessToken), "no webhook row is created").toEqual(before);
});
