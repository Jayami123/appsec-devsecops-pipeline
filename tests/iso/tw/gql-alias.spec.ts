// P5-TW-GQL-003 (tw-iso.md 8.7). Alias flood (D-TWISO-B27). The negative aliases one REAL root field: the fork
// sets checkDuplicateRootResolvers (graphql-config.service.ts:75) and refuses the duplicate (hook:272-276).
// The control aliases nested real fields under ONE root field, so it cannot trip the duplicate check.
import { BUDGETS } from "../../../src/security/budgets.ts";
import { actorWithCleanup } from "../../../src/lanes/tw-iso/actor-fixture.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import {
  nestedAliasQuery,
  rootAliasQuery,
} from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { classifyReply, describe } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

const REFUSAL = /Duplicate root resolver|Too many root resolvers requested/i;

test("P5-TW-GQL-003 control: three aliases return 200", async ({ run }) => {
  const actor = await actorWithCleanup(run, 21);
  const reply = await gqlPost(actor, nestedAliasQuery(3));
  expect(reply.status).toBe(200);
  expect(JSON.stringify(reply.body), "the control must not trip the duplicate check").not.toMatch(
    REFUSAL,
  );
});

test("P5-TW-GQL-003 alias flood at GQL_ALIAS_PROBE is refused or recorded as a design verdict", async ({
  run,
}) => {
  const actor = await actorWithCleanup(run, 22);
  expect((await gqlPost(actor, nestedAliasQuery(3))).status).toBe(200); // control first
  const outcome = classifyReply(
    await gqlPost(actor, rootAliasQuery(BUDGETS.GQL_ALIAS_PROBE.value)),
    REFUSAL,
  );
  test.info().annotations.push({
    type: "verdict",
    description: `${describe(outcome)}; ${BUDGETS.GQL_ALIAS_PROBE.value} aliases of one real root field`,
  });
  expect(outcome.verdict, "alias flood must be a PASS or a design verdict").not.toBe(
    "deployment finding",
  );
});
