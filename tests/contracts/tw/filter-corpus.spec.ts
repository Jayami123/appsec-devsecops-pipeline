// P5-TW-INJ-001 (tw-api). The control is a valid filter (200). Each FILTER_CORPUS value is sent as a
// company name filter. The oracle: no 500 and no SQL text in the body fork ref held by the owner).
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { FILTER_CORPUS } from "../../../src/lanes/tw/filter-corpus.ts";

const SQL_TEXT = /syntax error|\bpg_|ERROR:|SQLSTATE|near "/i;

test("P5-TW-INJ-001: filter corpus values never produce a 500 or SQL text", async () => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const get = (filter: string) =>
    fetch(`${base}/rest/companies?limit=1&filter=name[eq]:${encodeURIComponent(filter)}`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });

  const control = await get("p5-inj-control");
  expect(control.status, "control: a valid filter is 200").toBe(200);

  const failures: string[] = [];
  for (const [index, value] of FILTER_CORPUS.entries()) {
    const response = await get(value);
    const body = await response.text();
    if (response.status === 500) failures.push(`value ${index}: status 500`);
    if (SQL_TEXT.test(body)) failures.push(`value ${index}: SQL text in the body`);
  }
  expect(failures, "no corpus value yields a 500 or SQL text").toEqual([]);
});
