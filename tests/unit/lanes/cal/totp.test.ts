import { test } from "node:test";
import assert from "node:assert/strict";
import { totp } from "../../../../src/lanes/cal/totp.ts";

// RFC 6238 appendix B, SHA-1, seed "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ).
const SEED_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("totp matches the RFC 6238 SHA-1 vector at T=59 (287082)", () => {
  assert.equal(totp(SEED_BASE32, 59), "287082");
});

test("totp matches the RFC 6238 SHA-1 vector at T=1111111109 (081804)", () => {
  assert.equal(totp(SEED_BASE32, 1111111109), "081804");
});
