// P5-TW-GQL-005 (tw-iso.md 8.9). Introspection (D-TWISO-B28). The fork refuses ANONYMOUS introspection only in
// production (graphql-config.service.ts:66-68; hook use-disable-introspection-and-suggestions-for-unauthenticated-users.hook.ts:12-17).
import { actorWithCleanup } from "../../../src/lanes/tw-iso/actor-fixture.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import {
  introspectionQuery,
  shallowQuery,
} from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { nodeEnvFromBehaviour } from "../../../src/lanes/tw-iso/effective-config.ts";
import { classifyReply, describe } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

function schemaOf(body: unknown): unknown {
  return (body as { data?: { __schema?: unknown } | null } | null)?.data?.__schema;
}

test("P5-TW-GQL-005 control: authenticated introspection returns 200", async ({ run }) => {
  const actor = await actorWithCleanup(run, 31);
  const reply = await gqlPost(actor, introspectionQuery());
  expect(reply.status).toBe(200);
  expect(schemaOf(reply.body), "authenticated introspection returns __schema data").toBeDefined();
});

test("P5-TW-GQL-005 anonymous introspection is refused or recorded with the readback NODE_ENV", async ({
  run,
}) => {
  run.trackLeak({
    label: "anonymous caller: no resource is created",
    stillPresent: () => Promise.resolve(false),
  });
  const control = await gqlPost(null, shallowQuery()); // anonymous control: the endpoint answers anonymous callers
  expect(control.status, "anonymous control must answer 200").toBe(200);
  const reply = await gqlPost(null, introspectionQuery());
  const outcome = classifyReply(reply, /GraphQL introspection has been disabled/);
  if (outcome.verdict === "PASS") {
    expect(schemaOf(reply.body), "a refused introspection returns no __schema data").toBeFalsy();
  }
  test.info().annotations.push({
    type: "readback",
    description: `${describe(outcome)}; NODE_ENV=${nodeEnvFromBehaviour(outcome.verdict === "PASS")}`,
  });
  expect(outcome.verdict, "anonymous introspection must be a PASS or a design verdict").not.toBe(
    "deployment finding",
  );
});
