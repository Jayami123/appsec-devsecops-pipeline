import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalPdf } from "../../../../src/lanes/doc/pdf.ts";

test("minimalPdf starts with the PDF header and ends with the EOF marker", () => {
  const bytes = minimalPdf().toString("latin1");
  assert.ok(bytes.startsWith("%PDF-1.4\n"));
  assert.ok(bytes.trimEnd().endsWith("%%EOF"));
  // Every xref offset points at an "N 0 obj" line.
  const offsets = [...bytes.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.ok(offsets.length > 0);
  for (const off of offsets) assert.match(bytes.slice(off, off + 10), /^\d+ 0 obj/);
});
