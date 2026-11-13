// P5-TW-MASS-001 (tw-api), split into three titles (owner decision 1). Each title has the same control: a
// normal company create (companies POST, data.createCompany), which must be 201 with a server-assigned id.
// Per-field verdicts: id and deletedAt are design verdicts (they pass and are recorded with the stored value). createdBy
// is a PRODUCT BUG (SUSPECTED), marked with expectedDefect right before the unchanged assertion (owner decision 2).
// Detail is held by the owner (private-first).
import { randomUUID } from "node:crypto";
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";

type Company = {
  id: string;
  deletedAt: string | null;
  createdBy: { source: string; name: string };
};

async function createCompany(
  base: string,
  bearer: string,
  body: unknown,
): Promise<{ status: number; company?: Company }> {
  const response = await fetch(`${base}/rest/companies`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { data?: { createCompany?: Company } };
  return {
    status: response.status,
    ...(json.data?.createCompany === undefined ? {} : { company: json.data.createCompany }),
  };
}

async function destroy(base: string, bearer: string, id: string): Promise<number> {
  // Soft-deleted rows may refuse a plain delete; the status is recorded, never assumed.
  const response = await fetch(`${base}/rest/companies/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${bearer}` },
  });
  return response.status;
}

test("P5-TW-MASS-001 (id): create-time field, client value", async ({ run }, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const created: string[] = [];
  run.onCleanup(async () => {
    for (const id of created) await destroy(base, admin.accessToken, id);
  });
  const control = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-id-ctl`,
  });
  expect(control.status, "control: a normal create is 201").toBe(201);
  const controlCompany = control.company;
  if (controlCompany === undefined)
    throw new Error("TEST BUG: the control create returned no company");
  created.push(controlCompany.id);

  const clientId = randomUUID();
  const negative = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-id-neg`,
    id: clientId,
  });
  expect(negative.status, "a valid client UUID is accepted").toBe(201);
  const company = negative.company;
  if (company === undefined) throw new Error("TEST BUG: the negative create returned no company");
  created.push(company.id);
  testInfo.annotations.push({
    type: "design-verdict",
    description: `create-time id: the record id ${company.id === clientId ? "matches" : "differs from"} the client value (design verdict; detail held by the owner)`,
  });
  expect(company.id, "design: the client UUID is the record id").toBe(clientId);
});

test("P5-TW-MASS-001 (deletedAt): create-time field, client value", async ({ run }, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const created: string[] = [];
  run.onCleanup(async () => {
    for (const id of created) await destroy(base, admin.accessToken, id);
  });
  const control = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-del-ctl`,
  });
  expect(control.status, "control: a normal create is 201").toBe(201);
  if (control.company === undefined)
    throw new Error("TEST BUG: the control create returned no company");
  created.push(control.company.id);
  expect(control.company.deletedAt, "control: a normal create has no deletedAt").toBeNull();

  const negative = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-del-neg`,
    deletedAt: "2020-01-01T00:00:00Z",
  });
  expect(negative.status, "the create is accepted").toBe(201);
  if (negative.company === undefined)
    throw new Error("TEST BUG: the negative create returned no company");
  created.push(negative.company.id);
  testInfo.annotations.push({
    type: "design-verdict",
    description: `create-time deletedAt: stored value ${String(negative.company.deletedAt)} (design verdict; detail held by the owner)`,
  });
});

test("P5-TW-MASS-001 (createdBy): create-time field, client value", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const created: string[] = [];
  run.onCleanup(async () => {
    for (const id of created) await destroy(base, admin.accessToken, id);
  });
  const control = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-cb-ctl`,
  });
  expect(control.status, "control: a normal create is 201").toBe(201);
  const controlCompany = control.company;
  if (controlCompany === undefined)
    throw new Error("TEST BUG: the control create returned no company");
  created.push(controlCompany.id);

  const negative = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-cb-neg`,
    createdBy: { name: "forged", source: "IMPORT" },
  });
  expect(negative.status).toBe(201);
  const company = negative.company;
  if (company === undefined) throw new Error("TEST BUG: the negative create returned no company");
  created.push(company.id);

  expectedDefect("P5-TW-MASS-001: detail held by the owner");
  expect
    .soft(company.createdBy.source, "createdBy is the acting user, not the client value")
    .toBe(controlCompany.createdBy.source);
});
