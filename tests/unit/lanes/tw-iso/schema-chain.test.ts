import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDepthChain,
  chainDocument,
  schemaTypesFromIntrospection,
  type SchemaType,
} from "../../../../src/lanes/tw-iso/schema-chain.ts";

const ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";

// A fake schema with fixed names only. Pet and Survey form a single-object cycle; Query.pets is a list.
const SCHEMA: SchemaType[] = [
  {
    name: "Query",
    fields: [
      {
        name: "pet",
        singleObject: true,
        returns: "Pet",
        requiredArgs: [{ name: "filter", placeholder: `{ id: { eq: "${ID}" } }` }],
      },
      {
        name: "needsId",
        singleObject: true,
        returns: "Pet",
        requiredArgs: [{ name: "id", placeholder: undefined }],
      },
      { name: "pets", singleObject: false, returns: "Pet", requiredArgs: [] },
    ],
  },
  {
    name: "Pet",
    fields: [
      { name: "owner", singleObject: true, returns: "Survey", requiredArgs: [] },
      { name: "name", singleObject: false, requiredArgs: [] },
    ],
  },
  {
    name: "Survey",
    fields: [{ name: "pet", singleObject: true, returns: "Pet", requiredArgs: [] }],
  },
];

test("buildDepthChain fills a required argument with its placeholder and repeats the cycle to the depth", () => {
  assert.deepEqual(buildDepthChain(SCHEMA, "Query", 5), [
    `pet(filter: { id: { eq: "${ID}" } })`,
    "owner",
    "pet",
    "owner",
    "pet",
  ]);
});

test("buildDepthChain never uses a list field or a field whose argument has no placeholder", () => {
  const chain = buildDepthChain(SCHEMA, "Query", 3) ?? [];
  assert.ok(!chain.some((s) => s.startsWith("needsId")));
  assert.ok(!chain.some((s) => s.startsWith("pets")));
});

test("buildDepthChain returns undefined when no cycle is reachable", () => {
  const acyclic: SchemaType[] = [
    { name: "Query", fields: [{ name: "a", singleObject: true, returns: "A", requiredArgs: [] }] },
    { name: "A", fields: [{ name: "x", singleObject: false, requiredArgs: [] }] },
  ];
  assert.equal(buildDepthChain(acyclic, "Query", 4), undefined);
});

test("buildDepthChain refuses a depth that is not a positive integer", () => {
  assert.throws(() => buildDepthChain(SCHEMA, "Query", 0), /TEST BUG/);
});

test("chainDocument nests one selection set per step", () => {
  assert.equal(chainDocument(["a", "b(x: 1)"]), "{ a { b(x: 1) { __typename } } }");
  assert.throws(() => chainDocument([]), /TEST BUG/);
});

test("schemaTypesFromIntrospection marks single objects, lists and required arguments", () => {
  const introspection = [
    {
      kind: "OBJECT",
      name: "Query",
      fields: [
        { name: "one", args: [], type: { kind: "OBJECT", name: "A" } },
        {
          name: "many",
          args: [],
          type: {
            kind: "NON_NULL",
            ofType: { kind: "LIST", ofType: { kind: "OBJECT", name: "A" } },
          },
        },
        {
          name: "byId",
          args: [
            { name: "id", type: { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "UUID" } } },
          ],
          type: { kind: "OBJECT", name: "A" },
        },
        {
          name: "byOpt",
          args: [{ name: "filter", type: { kind: "INPUT_OBJECT", name: "Filter" } }],
          type: { kind: "OBJECT", name: "A" },
        },
        {
          name: "byNoIdFilter",
          args: [
            {
              name: "f",
              type: { kind: "NON_NULL", ofType: { kind: "INPUT_OBJECT", name: "Opt" } },
            },
          ],
          type: { kind: "OBJECT", name: "A" },
        },
      ],
    },
    {
      kind: "OBJECT",
      name: "A",
      fields: [{ name: "name", args: [], type: { kind: "SCALAR", name: "String" } }],
    },
    { kind: "OBJECT", name: "__Type", fields: [] },
    {
      kind: "INPUT_OBJECT",
      name: "Filter",
      inputFields: [{ name: "id", type: { kind: "INPUT_OBJECT", name: "UUIDFilter" } }],
    },
    {
      kind: "INPUT_OBJECT",
      name: "UUIDFilter",
      inputFields: [{ name: "eq", type: { kind: "SCALAR", name: "UUID" } }],
    },
    {
      kind: "INPUT_OBJECT",
      name: "Opt",
      inputFields: [{ name: "x", type: { kind: "SCALAR", name: "String" } }],
    },
  ];
  const types = schemaTypesFromIntrospection(introspection, { idFilterValue: ID });
  assert.equal(types.length, 2);
  const query = types.find((t) => t.name === "Query") as SchemaType;
  assert.deepEqual(query.fields[0], {
    name: "one",
    singleObject: true,
    returns: "A",
    requiredArgs: [],
  });
  assert.equal(query.fields[1]?.singleObject, false);
  assert.deepEqual(query.fields[2]?.requiredArgs, [
    { name: "id", placeholder: '"00000000-0000-0000-0000-000000000000"' },
  ]);
  assert.deepEqual(query.fields[3]?.requiredArgs, []); // optional argument: not required
  assert.deepEqual(query.fields[4]?.requiredArgs, [{ name: "f", placeholder: undefined }]);
});

test("schemaTypesFromIntrospection builds an id filter only from a well-formed UUID", () => {
  const introspection = [
    {
      kind: "OBJECT",
      name: "Query",
      fields: [
        {
          name: "pet",
          args: [
            {
              name: "filter",
              type: { kind: "NON_NULL", ofType: { kind: "INPUT_OBJECT", name: "Filter" } },
            },
          ],
          type: { kind: "OBJECT", name: "A" },
        },
      ],
    },
    { kind: "OBJECT", name: "A", fields: [] },
    {
      kind: "INPUT_OBJECT",
      name: "Filter",
      inputFields: [{ name: "id", type: { kind: "INPUT_OBJECT", name: "UUIDFilter" } }],
    },
    {
      kind: "INPUT_OBJECT",
      name: "UUIDFilter",
      inputFields: [{ name: "eq", type: { kind: "SCALAR", name: "UUID" } }],
    },
  ];
  const good = schemaTypesFromIntrospection(introspection, { idFilterValue: ID });
  assert.deepEqual(good[0]?.fields[0]?.requiredArgs, [
    { name: "filter", placeholder: `{ id: { eq: "${ID}" } }` },
  ]);
  const bad = schemaTypesFromIntrospection(introspection, { idFilterValue: 'x" } }' });
  assert.deepEqual(bad[0]?.fields[0]?.requiredArgs, [{ name: "filter", placeholder: undefined }]);
  const none = schemaTypesFromIntrospection(introspection);
  assert.deepEqual(none[0]?.fields[0]?.requiredArgs, [{ name: "filter", placeholder: undefined }]);
});

test("buildDepthChain tries the preferred root first", () => {
  const schema: SchemaType[] = [
    {
      name: "Query",
      fields: [
        { name: "other", singleObject: true, returns: "Survey", requiredArgs: [] },
        {
          name: "pet",
          singleObject: true,
          returns: "Pet",
          requiredArgs: [{ name: "filter", placeholder: `{ id: { eq: "${ID}" } }` }],
        },
      ],
    },
    {
      name: "Pet",
      fields: [{ name: "owner", singleObject: true, returns: "Survey", requiredArgs: [] }],
    },
    {
      name: "Survey",
      fields: [{ name: "pet", singleObject: true, returns: "Pet", requiredArgs: [] }],
    },
  ];
  assert.equal(
    buildDepthChain(schema, "Query", 2, "pet")?.[0],
    `pet(filter: { id: { eq: "${ID}" } })`,
  );
});
