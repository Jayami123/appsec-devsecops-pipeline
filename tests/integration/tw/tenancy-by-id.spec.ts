// NEW-TW-1 (tw-multiws, proposal; no P5 number, OD-12). A workspace B session reads or updates a workspace A company by
// its UUID, over REST and over GraphQL.
// Setup (asserted first): the recipe is on the stack and lvh.me resolves to loopback. Two throwaway owners, each with
// its own workspace. A creates a company with the run prefix in its name; the name is read before the negatives.
// Controls (same actor and resource class, before each negative): B reads and updates its own company on B's origin
// through the same route shape, so a refusal is not a malformed request.
// Negatives: B's session, presenting A's company UUID on A's origin, reads (REST) and updates (REST, GraphQL).
// Not built here: a GraphQL read by UUID (the query shape is not yet established; the update shape is, NEW-TW-7).
// Oracle: every negative is refused or returns no row; no value or id of A's company is in a negative response body;
// A's company name is unchanged (read before and after).
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import {
  assertLoopbackRecipeName,
  createCompany,
  seededPair,
  readRest,
  recipeRootUrl,
} from "./multiws-support.ts";

async function graphql(origin: string, bearer: string, query: string, variables: object) {
  const response = await fetch(`${origin}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ query, variables }),
  });
  return { status: response.status, text: await response.text() };
}

// The shape of tests/integration/tw/soft-deleted-mutation.spec.ts (NEW-TW-7).
const UPDATE_BY_ID = `mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id name } }`;

async function companyName(
  origin: string,
  bearer: string,
  id: string,
): Promise<string | undefined> {
  const read = await readRest({ url: `${origin}/rest/companies/${id}`, bearer });
  if (read.status !== 200) return undefined;
  const body = JSON.parse(read.text) as { data?: { company?: { name?: string } } };
  return body.data?.company?.name;
}

test("NEW-TW-1: a workspace B session cannot read or update a workspace A company by id @multiws", async ({
  run,
}) => {
  const root = recipeRootUrl(); // setup: ENV failure stops here, before any product call
  await assertLoopbackRecipeName(root.hostname);
  const { a, b } = await seededPair({ root, prefix: run.prefix, label: "nt1" });
  const name = `${run.prefix}-nt1-target`;
  const aId = await createCompany({ origin: a.origin, session: a.session, name });
  const bId = await createCompany({
    origin: b.origin,
    session: b.session,
    name: `${run.prefix}-nt1-own`,
  });
  const before = await companyName(a.origin, a.session.accessToken, aId);
  expect(before, "setup: A's company name is read before the negatives").toBe(name);

  // REST read: control on B's own company, then the negative on A's origin
  const restOwn = await readRest({
    url: `${b.origin}/rest/companies/${bId}`,
    bearer: b.session.accessToken,
  });
  expect(restOwn.status, "REST read control: B reads its own company").toBe(200);
  const restRead = await readRest({
    url: `${a.origin}/rest/companies/${aId}`,
    bearer: b.session.accessToken,
  });
  expect([400, 401, 403, 404], `REST read: refused (HTTP ${restRead.status})`).toContain(
    restRead.status,
  );
  expect(restRead.text.includes(name), "REST read: no value in the body").toBe(false);

  // REST update: control on B's own company, then the negative on A's origin
  const patchOwn = await fetch(`${b.origin}/rest/companies/${bId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${b.session.accessToken}`,
    },
    body: JSON.stringify({ name: `${run.prefix}-nt1-own-2` }),
  });
  expect(patchOwn.status, "REST update control: B updates its own company").toBe(200);
  const restWrite = await fetch(`${a.origin}/rest/companies/${aId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${b.session.accessToken}`,
    },
    body: JSON.stringify({ name: `${run.prefix}-nt1-overwritten` }),
  });
  expect([400, 401, 403, 404], `REST update: refused (HTTP ${restWrite.status})`).toContain(
    restWrite.status,
  );

  // GraphQL update: control on B's own company (same mutation), then the negative on A's origin
  const gqlWriteOwn = await graphql(b.origin, b.session.accessToken, UPDATE_BY_ID, {
    id: bId,
    data: { name: `${run.prefix}-nt1-own-3` },
  });
  expect(gqlWriteOwn.text.includes(bId), "GraphQL update control: B updates its own company").toBe(
    true,
  );
  const gqlWrite = await graphql(a.origin, b.session.accessToken, UPDATE_BY_ID, {
    id: aId,
    data: { name: `${run.prefix}-nt1-gql` },
  });
  expect(gqlWrite.text.includes(aId), "GraphQL update: no id of A's company in the body").toBe(
    false,
  );

  // oracle: A's company is unchanged
  const after = await companyName(a.origin, a.session.accessToken, aId);
  expect(after, "A's company name is unchanged after the negatives").toBe(name);
});
