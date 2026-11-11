import { test } from "node:test";
import assert from "node:assert/strict";
import { totp } from "../../../../src/lanes/doc/totp.ts";

// RFC 6238 Appendix B SHA-1 vectors: the ASCII secret "12345678901234567890", eight-digit codes
// 94287082 (T=59) and 07081804 (T=1111111109). The six-digit forms are the last six digits.
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");

test("totp matches the RFC 6238 SHA-1 vector at T=59 (287082 for the six-digit form of 94287082)", () => {
  assert.equal(totp(RFC_SECRET, 59), "287082");
});

test("totp matches the RFC 6238 SHA-1 vector at T=1111111109 (081804)", () => {
  assert.equal(totp(RFC_SECRET, 1111111109), "081804");
});
