// MI-16 (tw-api). Routes: createApiKey, generateApiKeyToken, revokeApiKey and the apiKey read, all on
// the metadata endpoint (api-key.resolver.ts:53-132; auth.resolver.ts:1088). The oracle is a REST read
// with the key: 200 before revocation and 401 or 403 after, with the revocation read back first.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { createApiKey, restStatus, revokeApiKey } from "../../../src/lanes/tw/keys.ts";
import { gql } from "../../../src/lanes/tw/gql.ts";

test("MI-16: a revoked API key is refused", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const key = await createApiKey({ baseUrl: base, session: admin, name: `${run.prefix}-mi16` });
  let revoked = false;
  run.onCleanup(async () => {
    if (!revoked) await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  });
  run.trackLeak({
    label: `api key ${key.id}`,
    stillPresent: async () =>
      (await restStatus({ baseUrl: base, path: "/rest/companies?limit=1", bearer: key.secret })) ===
      200,
  });

  const control = await restStatus({
    baseUrl: base,
    path: "/rest/companies?limit=1",
    bearer: key.secret,
  });
  expect(control, "control: the live key reads companies").toBe(200);

  await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  revoked = true;
  const evidence = await gql<{ apiKey: { revokedAt: string | null } | null }>({
    baseUrl: base,
    endpoint: "metadata",
    bearer: admin.accessToken,
    operation: "apiKey",
    query: `query K($input: GetApiKeyInput!) { apiKey(input: $input) { revokedAt } }`,
    variables: { input: { id: key.id } }, // api-key.resolver.ts:53-54 (args: input)
  });
  expect(evidence.apiKey?.revokedAt, "revocation is evidenced by a read").not.toBeNull();

  const negative = await restStatus({
    baseUrl: base,
    path: "/rest/companies?limit=1",
    bearer: key.secret,
  });
  expect([401, 403], "the revoked key is refused").toContain(negative);
});
