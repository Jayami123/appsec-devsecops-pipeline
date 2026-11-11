// P5-DOC-NEW-DOC-3 upload abuse (doc plan section 4.5). Route: POST /api/files/upload-pdf (files.ts:29, form
// field `file`); needs a session (files.ts:15). Limit: the upload route is limited (DOC_ROUTE_LIMITS.upload,
// budgets.ts:32-38). Serial: it consumes the upload window, so it runs on its own stack (C13).
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { docRouteLimit } from "../../../src/lanes/doc/limits.ts";
import { minimalPdf } from "../../../src/lanes/doc/pdf.ts";

const UPLOAD_PATH = "/api/files/upload-pdf";
let uploads = 0;

async function upload(
  request: import("@playwright/test").APIRequestContext,
  name: string,
  mimeType: string,
  buffer: Buffer,
): Promise<number> {
  uploads += 1;
  const res = await request.post(`${apiBaseUrl("documenso")}${UPLOAD_PATH}`, {
    multipart: { file: { name, mimeType, buffer } },
  });
  return res.status();
}

test.describe("P5-DOC-NEW-DOC-3", () => {
  test("NEW-DOC-3 valid PDF upload is accepted (control)", async ({ actors }) => {
    const owner = actorOf(actors, "owner");
    const status = await upload(owner.request, "p5-control.pdf", "application/pdf", minimalPdf());
    expect(status).toBe(200);
  });

  test("NEW-DOC-3 text labelled as PDF is refused with 4xx", async ({ actors }) => {
    const owner = actorOf(actors, "owner");
    const status = await upload(
      owner.request,
      "p5-text-as-pdf.pdf",
      "application/pdf",
      Buffer.from("plain text, not a PDF\n"),
    );
    expect(status, "PRODUCT BUG (SUSPECTED) if accepted").toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  test("NEW-DOC-3 oversized upload is refused with 4xx", async ({ actors }) => {
    const owner = actorOf(actors, "owner");
    const cap = BUDGETS.DOC_UPLOAD_OVERSIZE_BYTES.value;
    const header = Buffer.from("%PDF-1.4\n");
    const oversize = Buffer.concat([header, Buffer.alloc(cap - header.length)]);
    const status = await upload(owner.request, "p5-oversize.pdf", "application/pdf", oversize);
    expect(status, "PRODUCT BUG (SUSPECTED) if accepted").toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  test("NEW-DOC-3 polyglot upload is refused or not served as HTML", async ({ actors }) => {
    const owner = actorOf(actors, "owner");
    const polyglot = Buffer.from("%PDF-1.4\n<html><script>0</script></html>\n%%EOF\n");
    const status = await upload(owner.request, "p5-polyglot.pdf", "application/pdf", polyglot);
    expect(status, "PRODUCT BUG (SUSPECTED) if accepted").toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    // Last case: the whole run stays below the cited upload limit (control + DOC_UPLOAD_CASES), read by name.
    expect(uploads).toBe(1 + BUDGETS.DOC_UPLOAD_CASES.value);
    expect(uploads).toBeLessThan(docRouteLimit("upload"));
  });
});
