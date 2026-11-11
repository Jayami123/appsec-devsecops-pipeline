import { test } from "node:test";
import assert from "node:assert/strict";
import { totpAt, decodeBase32 } from "../../../../src/lanes/tw/totp.ts";

// RFC 6238 Appendix B, SHA-1, secret "12345678901234567890" (8-digit reference values, last 6 digits).
const SECRET = Buffer.from("12345678901234567890", "utf8");

test("RFC 6238 vector at T=59 is 287082", () => {
  assert.equal(totpAt(SECRET, 59), "287082");
});

test("RFC 6238 vector at T=1111111109 is 081804", () => {
  assert.equal(totpAt(SECRET, 1111111109), "081804");
});

test("decodeBase32 decodes the RFC 4648 vector MZXW6=== to foo", () => {
  assert.equal(decodeBase32("MZXW6===").toString("utf8"), "foo");
});
