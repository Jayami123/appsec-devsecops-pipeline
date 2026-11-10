// P5-TW-GQL-002 (tw-iso.md 8.6). Requested field count above the effective cap. The cap comes from the readback
// (no named budget, tw-iso.md section 13 item 11). Real fields only (overFieldsQuery): __typename aliases are
// not counted by the cap (live evidence). Actor: anonymous caller (D-TWISO-B14).
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import { overFieldsQuery, shallowQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { readEffectiveConfig } from "../../../src/lanes/tw-iso/effective-config.ts";
import { classifyReply, describe, errorMessages } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

const CAP_MESSAGE = /too many fields requested/i;

test("P5-TW-GQL-002 control: cheap query returns 200", async () => {
  expect((await gqlPost(null, shallowQuery())).status).toBe(200);
});

test("P5-TW-GQL-002 query above the effective field cap is refused or recorded as a design verdict", async () => {
  expect((await gqlPost(null, shallowQuery())).status).toBe(200); // control first
  const cap = readEffectiveConfig().GRAPHQL_MAX_FIELDS.value;
  const atCap = await gqlPost(null, overFieldsQuery(cap));
  const overCap = classifyReply(await gqlPost(null, overFieldsQuery(cap + 1)), CAP_MESSAGE);
  const atCapRefused = errorMessages(atCap.body).some((m) => CAP_MESSAGE.test(m));
  test.info().annotations.push({
    type: "verdict",
    description: `cap=${cap} requested=${cap}: refused by cap=${String(atCapRefused)} status=${atCap.status}; requested=${cap + 1}: ${describe(overCap)}`,
  });
  expect(overCap.verdict, "cap + 1 must be a PASS or a design verdict").not.toBe(
    "deployment finding",
  );
});

test("P5-TW-GQL-002 records the effective GRAPHQL_MAX_FIELDS read back from the stack", async () => {
  const effective = readEffectiveConfig().GRAPHQL_MAX_FIELDS;
  test.info().annotations.push({
    type: "readback",
    description: `GRAPHQL_MAX_FIELDS=${String(effective.value)} (${effective.source})`,
  });
  expect((await gqlPost(null, shallowQuery())).status).toBe(200);
});
