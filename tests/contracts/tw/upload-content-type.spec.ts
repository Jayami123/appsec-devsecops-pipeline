// NEW-TW-4 (tw-api). Upload is a two-step product route (metadata endpoint): createFileUpload -> PUT to the returned
// uploadUrl -> completeFileUpload -> GET the signed URL. Served headers: the stored MIME type, X-Content-Type-Options:
// nosniff, and Content-Disposition inline only for an allow-list of types.
// Control: a real PNG is served as image/png, inline. Negative (a): HTML bytes with a .png name are refused at
// completion (content does not match the extension). Negative (b): an SVG with a script element is served as
// image/svg+xml with attachment disposition. Oracle: nothing is served as a script-executing type inline.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f8e1b00000000049454e44ae426082",
  "hex",
);
const FOLDER = "EmailAttachment"; // accepts a direct upload without a field id

/** The signed URL may be relative to the server; this keeps the call on the lane base URL. */
function absoluteUrl(base: string, url: string | undefined): string {
  if (url === undefined) throw new Error("TEST BUG: no signed URL returned");
  return url.startsWith("http") ? url : `${base}${url}`;
}

async function upload(
  base: string,
  bearer: string,
  filename: string,
  body: Buffer,
): Promise<{ completed: boolean; reason?: string; url?: string; contentType?: string }> {
  const gqlCall = async (query: string, variables: object) =>
    (await (
      await fetch(`${base}/metadata`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ query, variables }),
      })
    ).json()) as {
      data?: Record<string, Record<string, unknown>>;
      errors?: Array<{ message: string }>;
    };
  const target = await gqlCall(
    `mutation T($filename: String!, $size: Float!, $fileFolder: FileFolder!) { createFileUpload(filename: $filename, size: $size, fileFolder: $fileFolder) { fileId uploadUrl contentType } }`,
    { filename, size: body.length, fileFolder: FOLDER },
  );
  if (target.errors !== undefined || target.data === undefined)
    throw new Error(`TEST BUG: createFileUpload: ${target.errors?.[0]?.message ?? "no data"}`);
  const t = target.data.createFileUpload as { fileId: string; uploadUrl: string };
  const put = await fetch(t.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body,
  });
  if (put.status !== 204) throw new Error(`TEST BUG: PUT returned ${put.status}`);
  const done = await gqlCall(
    `mutation C($fileId: String!) { completeFileUpload(fileId: $fileId) { url } }`,
    { fileId: t.fileId },
  );
  if (done.errors !== undefined || done.data === undefined) {
    return { completed: false, reason: done.errors?.[0]?.message.slice(0, 120) ?? "no data" };
  }
  const url = (done.data.completeFileUpload as { url?: string } | undefined)?.url;
  if (url === undefined) return { completed: false, reason: "no signed URL" };
  return { completed: true, url };
}

test("NEW-TW-4: an attachment cannot execute script when served", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)

  const control = await upload(base, admin.accessToken, `${run.prefix}-control.png`, PNG);
  expect(control.completed, "control: a real PNG is accepted").toBe(true);
  const served = await fetch(absoluteUrl(base, control.url));
  expect(served.headers.get("content-type"), "control: served as image/png").toBe("image/png");
  expect(served.headers.get("content-disposition"), "control: inline for an image").toBe("inline");

  const spoof = await upload(
    base,
    admin.accessToken,
    `${run.prefix}-spoof.png`,
    Buffer.from("<html><script>alert(1)</script></html>"),
  );
  expect(spoof.completed, "negative (a): HTML bytes with a .png name are refused").toBe(false);

  const svg = await upload(
    base,
    admin.accessToken,
    `${run.prefix}-script.svg`,
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  );
  expect(svg.completed, "negative (b): the SVG is accepted (its type is not the issue)").toBe(true);
  const svgServed = await fetch(absoluteUrl(base, svg.url));
  expect(svgServed.headers.get("content-disposition"), "an SVG is served as an attachment").toBe(
    "attachment",
  );
  expect(svgServed.headers.get("x-content-type-options"), "nosniff is set").toBe("nosniff");
});
