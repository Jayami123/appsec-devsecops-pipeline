// P5-TW-GQL-005 (tw-iso.md 8.9). Anonymous introspection. Gated by NODE_ENV=production (fork
// graphql-config.service.ts:66-67). The anonymous control proves the endpoint answers an anonymous caller.
// Built: title 2 only. The authenticated control (title 1 of the plan) needs a throwaway account, which the
// single-workspace stack refuses to create (D-TWISO-B14); that title is GATED, not built.
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import {
  introspectionQuery,
  shallowQuery,
} from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { readEffectiveConfig } from "../../../src/lanes/tw-iso/effective-config.ts";
import { errorMessages } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

function answeredSchema(body: unknown): boolean {
  const data = (body as { data?: { __schema?: unknown } | null } | null)?.data;
  return (
    data !== null && data !== undefined && data.__schema !== undefined && data.__schema !== null
  );
}

test("P5-TW-GQL-005 anonymous introspection is refused or recorded with the readback NODE_ENV", async () => {
  const control = await gqlPost(null, shallowQuery()); // anonymous control: the endpoint answers anonymous callers
  expect(control.status, "anonymous control must answer 200").toBe(200);
  const reply = await gqlPost(null, introspectionQuery());
  const answered = answeredSchema(reply.body);
  const verdict = answered ? "design verdict" : "PASS";
  test.info().annotations.push({
    type: "readback",
    description: `NODE_ENV=${readEffectiveConfig().NODE_ENV.value} status=${reply.status} schema_answered=${String(answered)} verdict=${verdict} messages=${errorMessages(reply.body).length}`,
  });
});
