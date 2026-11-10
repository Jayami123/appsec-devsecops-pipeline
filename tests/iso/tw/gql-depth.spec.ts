// P5-TW-GQL-001 (tw-iso.md 8.5). Nested query depth.
// Actor: anonymous caller (D-TWISO-B14). Built: the control and the readback (titles 1 and 3).
// GATED: the depth probe (title 2 of the plan). Live evidence: a nested chain of __type/ofType is refused by
// the introspection gate ("GraphQL introspection has been disabled") for an anonymous caller, which is a
// different refusal, so it cannot prove a depth result. No nested depth limit is configured (probe C1), and
// no anonymous non-introspection object chain is known on this stack. No spec, no job for that title.
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import { shallowQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { readEffectiveConfig } from "../../../src/lanes/tw-iso/effective-config.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

test("P5-TW-GQL-001 control: shallow nested query returns 200", async () => {
  expect((await gqlPost(null, shallowQuery())).status).toBe(200);
});

test("P5-TW-GQL-001 records the effective field and depth configuration read back from the stack", async () => {
  const effective = readEffectiveConfig();
  test.info().annotations.push({
    type: "readback",
    description: `GRAPHQL_MAX_FIELDS=${String(effective.GRAPHQL_MAX_FIELDS.value)} (${effective.GRAPHQL_MAX_FIELDS.source}); nested depth limit: none configured (probe C1)`,
  });
  expect((await gqlPost(null, shallowQuery())).status).toBe(200);
});
