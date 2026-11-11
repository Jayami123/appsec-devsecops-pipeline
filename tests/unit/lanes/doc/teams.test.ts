import { test } from "node:test";
import assert from "node:assert/strict";
import { organisationIdFrom, teamIdFrom } from "../../../../src/lanes/doc/teams.ts";

test("organisationIdFrom reads the first organisation id from the superjson wrapper", () => {
  assert.equal(organisationIdFrom({ result: { data: { json: [{ id: "org_abc" }] } } }), "org_abc");
});

test("teamIdFrom reads the first team id from a find result", () => {
  assert.equal(
    teamIdFrom({ result: { data: { json: { data: [{ id: 7 }], currentPage: 1 } } } }),
    7,
  );
});

test("teamIdFrom refuses a list with no team", () => {
  assert.throws(() => teamIdFrom({ result: { data: { json: { data: [] } } } }), /no team/);
});
