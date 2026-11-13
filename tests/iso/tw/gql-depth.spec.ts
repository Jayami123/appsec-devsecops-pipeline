// P5-TW-GQL-001 (tw-iso.md 8.5). Nested query depth. Actor: one throwaway member (D-TWISO-B24).
// The chain is REAL object fields of the authenticated /graphql schema, built at run time (D-TWISO-B31). Its one
// root filter takes the id of a record the dev seed holds (read with the actor), so the root resolves to data.
// No nested depth limit is configured (fork ref held by the owner), so a 200 with data is a design verdict.
import { BUDGETS } from "../../../src/security/budgets.ts";
import { actorWithCleanup } from "../../../src/lanes/tw-iso/actor-fixture.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import {
  buildDepthChain,
  chainDocument,
  schemaTypesFromIntrospection,
  type IntrospectionNamedType,
} from "../../../src/lanes/tw-iso/schema-chain.ts";
import { shallowQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { readEffectiveConfig } from "../../../src/lanes/tw-iso/effective-config.ts";
import { classifyReply, describe } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

// Introspection of object and input types, with the nesting the converter reads (fields, args, input fields).
const TYPE_REF = "{ kind name ofType { kind name ofType { kind name ofType { kind name } } } }";
const SCHEMA_QUERY = `{ __schema { queryType { name } types { kind name fields { name args { name type ${TYPE_REF} } type ${TYPE_REF} } inputFields { name type ${TYPE_REF} } } } }`;

test("P5-TW-GQL-001 control: shallow nested query returns 200", async ({ run }) => {
  const actor = await actorWithCleanup(run, 1);
  expect((await gqlPost(actor, shallowQuery())).status).toBe(200);
});

test("P5-TW-GQL-001 depth probe at GQL_DEPTH_PROBE is refused or recorded as a design verdict", async ({
  run,
}) => {
  const actor = await actorWithCleanup(run, 2);
  expect((await gqlPost(actor, shallowQuery())).status).toBe(200); // control first
  const seeded = await gqlPost(actor, "{ pets(first: 1) { edges { node { id } } } }");
  const petId = (seeded.body as { data?: { pets?: { edges?: { node?: { id?: string } }[] } } }).data
    ?.pets?.edges?.[0]?.node?.id;
  expect(petId, "the dev seed holds a record for the root filter").toBeDefined();
  const introspection = await gqlPost(actor, SCHEMA_QUERY);
  const schema = (
    introspection.body as {
      data?: { __schema?: { queryType: { name: string }; types: IntrospectionNamedType[] } };
    }
  ).data?.__schema;
  expect(schema, "authenticated introspection gives the schema").toBeDefined();
  const types = schemaTypesFromIntrospection(schema?.types ?? [], { idFilterValue: petId });
  // The root for the record read above: the seeded id belongs to that record type (pets -> pet).
  const preferRoot = "pets".replace(/s$/, "");
  const steps = buildDepthChain(
    types,
    schema?.queryType.name ?? "Query",
    BUDGETS.GQL_DEPTH_PROBE.value,
    preferRoot,
  );
  expect(steps, "a single-object cycle is reachable from a root field").toBeDefined();
  const reply = await gqlPost(actor, chainDocument(steps ?? []));
  const outcome = classifyReply(reply, /too many nested fields requested/i);
  const hasData =
    (reply.body as { data?: unknown }).data !== undefined &&
    (reply.body as { data?: unknown }).data !== null;
  test.info().annotations.push({
    type: "verdict",
    description: `${describe(outcome)}; depth=${BUDGETS.GQL_DEPTH_PROBE.value} real fields; data returned=${String(hasData)}`,
  });
  expect(outcome.verdict, "depth probe must be a PASS or a design verdict").not.toBe(
    "deployment finding",
  );
});

test("P5-TW-GQL-001 records the effective field and depth configuration read back from the stack", async ({
  run,
}) => {
  const actor = await actorWithCleanup(run, 3);
  const effective = readEffectiveConfig();
  test.info().annotations.push({
    type: "readback",
    description: `GRAPHQL_MAX_FIELDS=${String(effective.GRAPHQL_MAX_FIELDS.value)} (${effective.GRAPHQL_MAX_FIELDS.source}); nested depth limit: none configured (probe C1)`,
  });
  expect((await gqlPost(actor, shallowQuery())).status).toBe(200);
});
