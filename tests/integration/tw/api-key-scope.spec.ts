// NEW-TW-2 case (b) (tw-api). A key K_A is created in the workspace (api-key.resolver.ts:79), creates a
// webhook (control, POST /rest/webhooks 201), is revoked and read back, and its next create is refused
// with the webhook list unchanged.
// NEW-TW-2 case (a) (tw-multiws, D-TW-B46): a key of workspace A used on workspace B is refused, and B's webhook list
// is unchanged. Its own control (the key creates a webhook on A) runs first.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { createApiKey, revokeApiKey } from "../../../src/lanes/tw/keys.ts";
import { gql } from "../../../src/lanes/tw/gql.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import {
  assertLoopbackRecipeName,
  seededPair,
  readRest,
  recipeRootUrl,
} from "./multiws-support.ts";

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

test("NEW-TW-2 (a): an API key of one workspace cannot create a webhook in another @multiws", async ({
  run,
}) => {
  const root = recipeRootUrl(); // setup: ENV failure stops here, before any product call
  await assertLoopbackRecipeName(root.hostname);
  const { a, b } = await seededPair({ root, prefix: run.prefix, label: "nt2" });
  const key = await createApiKey({
    baseUrl: a.origin,
    session: a.admin,
    name: `${run.prefix}-scope-a`,
  });
  run.onCleanup(() =>
    revokeApiKey({ baseUrl: a.origin, session: a.admin, keyId: key.id }).catch(() => undefined),
  );

  // control: A's key creates a webhook in A
  const control = await fetch(`${a.origin}/rest/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key.secret}` },
    body: JSON.stringify({ ...HOOK, targetUrl: "http://127.0.0.1:9/p5-scope-a" }),
  });
  expect(control.status, "control: A's key creates a webhook in A").toBe(201);
  const controlId = (await control.json()) as {
    data?: { createWebhook?: { id: string } };
    id?: string;
  };
  const createdId = controlId.data?.createWebhook?.id ?? controlId.id;
  run.onCleanup(async () => {
    if (createdId !== undefined) {
      await fetch(`${a.origin}/rest/webhooks/${createdId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${a.admin.accessToken}` },
      });
    }
  });

  // negative: A's key on B's origin, B's list before and after
  const listUrl = `${b.origin}/rest/webhooks?limit=200`;
  const before = await readRest({ url: listUrl, bearer: b.admin.accessToken });
  expect(before.status, "control: B's admin lists its webhooks").toBe(200);
  const negative = await fetch(`${b.origin}/rest/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key.secret}` },
    body: JSON.stringify({ ...HOOK, targetUrl: "http://127.0.0.1:9/p5-scope-b" }),
  });
  // A 201 from B is kept out of the list check: the row it created is removed in cleanup (private-first detail is
  // held by the owner; the repository carries the ID and the status only).
  const crossBody =
    negative.status === 201
      ? ((await negative.json()) as { data?: { createWebhook?: { id?: string } }; id?: string })
      : undefined;
  const crossId = crossBody?.data?.createWebhook?.id ?? crossBody?.id;
  // The row may land in B (the origin) or in A (the key's workspace). Both lists are read, and cleanup removes the row
  // from both (a DELETE of an id that is not in a workspace is harmless).
  if (crossId !== undefined) {
    run.onCleanup(async () => {
      for (const side of [b, a]) {
        await fetch(`${side.origin}/rest/webhooks/${crossId}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${side.admin.accessToken}` },
        });
      }
    });
  }
  const listedInA =
    crossId !== undefined &&
    (
      await readRest({ url: `${a.origin}/rest/webhooks?limit=200`, bearer: a.admin.accessToken })
    ).text.includes(crossId);
  const listedInB =
    crossId !== undefined &&
    (await readRest({ url: listUrl, bearer: b.admin.accessToken })).text.includes(crossId);
  // Expected defect only when the defect reproduces: a 201 for A's key on B's origin, and the row is listed in A or B.
  // Evidence is status only (private-first).
  if (negative.status === 201 && (listedInA || listedInB)) {
    expectedDefect(
      "NEW-TW-2: a key of one workspace creates a webhook on another workspace's origin (status 201, row listed). Private-first: details held by the owner.",
    );
  }
  expect([400, 401, 403], `negative: A's key is refused on B (HTTP ${negative.status})`).toContain(
    negative.status,
  );
  const after = await readRest({ url: listUrl, bearer: b.admin.accessToken });
  expect(after.text, "negative: B's webhook list is unchanged").toEqual(before.text);
});
