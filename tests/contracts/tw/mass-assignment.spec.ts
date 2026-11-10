// P5-TW-MASS-001 (tw-api). The control is a normal company create (companies POST, data.createCompany).
// The negative sends client-supplied id, deletedAt and createdBy. The oracle: the server ignores the
// client id, returns deletedAt null, and records createdBy as the acting user (the control's value).
import { randomUUID } from "node:crypto";
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";

// Unique per run: a fixed id collides with a row from an earlier run (TEST BUG fixed).
const FORGED_ID = randomUUID();
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

test("P5-TW-MASS-001: client-supplied id, createdBy and deletedAt are ignored", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const created: string[] = [];
  run.onCleanup(async () => {
    for (const id of created) {
      await fetch(`${base}/rest/companies/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });
    }
  });

  const control = await createCompany(base, admin.accessToken, { name: `${run.prefix}-mass-ctl` });
  expect(control.status, "control: a normal create is 201").toBe(201);
  const controlCompany = control.company;
  if (controlCompany === undefined)
    throw new Error("TEST BUG: the control create returned no company");
  created.push(controlCompany.id);

  const negative = await createCompany(base, admin.accessToken, {
    name: `${run.prefix}-mass-neg`,
    id: FORGED_ID,
    deletedAt: "2020-01-01T00:00:00Z",
    createdBy: { name: "forged", source: "IMPORT" },
  });
  expect(negative.status).toBe(201);
  const company = negative.company;
  if (company === undefined) throw new Error("TEST BUG: the negative create returned no company");
  created.push(company.id);

  expect.soft(company.id, "the client-supplied id is not used").not.toBe(FORGED_ID);
  expect.soft(company.deletedAt, "the client-supplied deletedAt is ignored").toBeNull();
  expect
    .soft(company.createdBy.source, "createdBy is the acting user, not the client value")
    .toBe(controlCompany.createdBy.source);
});
