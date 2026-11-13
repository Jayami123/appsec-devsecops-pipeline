// NEW-TW-7 (tw-api; pairs with MI-17). The control is a GraphQL updateCompany on a live company (data
// API, /graphql). The record is soft-deleted (REST DELETE /rest/companies/:id),
// then the same GraphQL mutation is sent. The oracle: refused, and the record is still absent from a REST read after
// the refused mutation.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";

const UPDATE = `mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id name } }`;

test("NEW-TW-7: a GraphQL mutation on a soft-deleted record is refused", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const H = { authorization: `Bearer ${admin.accessToken}`, "content-type": "application/json" };
  const gql = async (variables: object) =>
    (await (
      await fetch(`${base}/graphql`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({ query: UPDATE, variables }),
      })
    ).json()) as {
      data?: { updateCompany?: { id: string; name: string } | null };
      errors?: Array<{ message: string }>;
    };

  const created = (await (
    await fetch(`${base}/rest/companies`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ name: `${run.prefix}-sd-live` }),
    })
  ).json()) as { data: { createCompany: { id: string } } };
  const liveId = created.data.createCompany.id;
  let deleted = false;
  run.onCleanup(async () => {
    if (!deleted) await fetch(`${base}/rest/companies/${liveId}`, { method: "DELETE", headers: H });
  });

  const control = await gql({ id: liveId, data: { name: `${run.prefix}-sd-live-2` } });
  expect(control.errors, "control: the live record accepts the mutation").toBeUndefined();
  expect(control.data?.updateCompany?.name).toBe(`${run.prefix}-sd-live-2`);

  const removed = await fetch(`${base}/rest/companies/${liveId}`, { method: "DELETE", headers: H });
  expect(removed.status, "the record is soft-deleted").toBe(200);
  deleted = true;
  const before = await fetch(`${base}/rest/companies/${liveId}`, { headers: H });
  expect(before.status, "the soft-deleted record is absent from REST reads").toBe(404);

  const negative = await gql({ id: liveId, data: { name: `${run.prefix}-sd-changed` } });
  expect(negative.data?.updateCompany ?? null, "the mutation is refused").toBeNull();
  expect(negative.errors?.length ?? 0, "the refusal is an error").toBeGreaterThan(0);
  const after = await fetch(`${base}/rest/companies/${liveId}`, { headers: H });
  expect(after.status, "the record stays deleted").toBe(404);
});
