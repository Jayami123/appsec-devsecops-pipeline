// P5-TW-RLS-001 (MI-17) (tw-api). The hidden-record title of RLS-001 is GATED (see the PR body): row-level predicates
// need an enterprise plan and a billing entitlement, which the harness stack does not provide (detail held by the
// owner). This file builds only the MI-17 case: a
// soft-deleted record is absent from search. Control: the live record is in search (REST list, filter by name).
// Negative: after DELETE /rest/companies/:id (soft delete, status 200), the record is absent from the same search and
// the id read returns no entity. Before and after state is recorded for the mutation.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";

test("P5-TW-RLS-001 (MI-17): a soft-deleted record is absent from search", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const H = { authorization: `Bearer ${admin.accessToken}`, "content-type": "application/json" };
  const name = `${run.prefix}-mi17`;
  const created = (await (
    await fetch(`${base}/rest/companies`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ name }),
    })
  ).json()) as { data: { createCompany: { id: string } } };
  const id = created.data.createCompany.id;
  const search = async (): Promise<string[]> => {
    const response = await fetch(
      `${base}/rest/companies?limit=200&filter=name[eq]:${encodeURIComponent(name)}`,
      { headers: H },
    );
    const body = (await response.json()) as { data?: { companies?: Array<{ id: string }> } };
    return (body.data?.companies ?? []).map((row) => row.id);
  };
  run.trackLeak({
    label: `company ${id}`,
    stillPresent: async () => {
      const response = await fetch(`${base}/rest/companies/${id}`, { headers: H });
      const body = (await response.json().catch(() => null)) as {
        data?: { company?: { id?: string } };
      } | null;
      return response.status === 200 && body?.data?.company?.id === id;
    },
  });

  const before = await search();
  expect(before, "control: the live record is in search").toContain(id);

  const removed = await fetch(`${base}/rest/companies/${id}`, { method: "DELETE", headers: H });
  expect(removed.status, "the record is soft-deleted").toBe(200);

  const after = await search();
  expect(after, "negative: the soft-deleted record is absent from search").not.toContain(id);
});
