// RFC 6238 TOTP over HMAC-SHA1 with node:crypto only (no new dependency). Lane-local: a shared TOTP
// module is deferred to a foundation PR (D-DOC-B12).
import { createHmac } from "node:crypto";

/** Protocol parameters of RFC 6238 and the Documenso two-factor flow (doc plan section 6.2). Not budgets. */
export const TOTP_DIGITS = 6;
/** RFC 6238 default time step, 30 seconds. */
export const TOTP_STEP_S = 30;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 decode (case-insensitive, padding and spaces ignored). Throws on an invalid character. */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`TEST BUG: invalid base32 character in TOTP secret`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226) for one counter value. */
function hotp(key: Buffer, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  // Counter is a non-negative integer below 2^53 for every time step used here.
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(msg).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code =
    ((hmac[offset] ?? 0) & 0x7f) * 0x1000000 +
    ((hmac[offset + 1] ?? 0) & 0xff) * 0x10000 +
    ((hmac[offset + 2] ?? 0) & 0xff) * 0x100 +
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

/** TOTP code for a key (raw bytes) at a Unix time in seconds. Returns TOTP_DIGITS digits by default. */
export function totp(key: Buffer, unixTimeS: number, digits: number = TOTP_DIGITS): string {
  return hotp(key, Math.floor(unixTimeS / TOTP_STEP_S), digits);
}

/** TOTP code for a base32 secret (the form the two-factor setup response returns) at the current time. */
export function totpNow(base32Secret: string, now: Date = new Date()): string {
  return totp(base32Decode(base32Secret), now.getTime() / 1000);
}
