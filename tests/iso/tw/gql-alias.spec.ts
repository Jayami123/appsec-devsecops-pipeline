// P5-TW-GQL-003 (tw-iso.md 8.7). Alias flood. A refusal names the cap that refused (field cap or root-resolver
// cap), because aliases of one root field can be counted as root resolvers (fork hook.ts:87-91, cap 20).
// Actor: anonymous caller (D-TWISO-B14).
import { BUDGETS } from "../../../src/security/budgets.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import { aliasQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { classifyReply, describe } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

test("P5-TW-GQL-003 control: three aliases return 200", async () => {
  expect((await gqlPost(null, aliasQuery(3))).status).toBe(200);
});

test("P5-TW-GQL-003 alias flood at GQL_ALIAS_PROBE is refused or recorded as a design verdict", async () => {
  expect((await gqlPost(null, aliasQuery(3))).status).toBe(200); // control first
  const outcome = classifyReply(
    await gqlPost(null, aliasQuery(BUDGETS.GQL_ALIAS_PROBE.value)),
    /too many (fields|root resolvers) requested/i,
  );
  test.info().annotations.push({ type: "verdict", description: describe(outcome) });
  expect(outcome.verdict, "alias flood must be a PASS or a design verdict").not.toBe(
    "deployment finding",
  );
});
