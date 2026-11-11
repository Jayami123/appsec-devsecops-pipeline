// RFC 6238 TOTP: HMAC-SHA-1, 6 digits, 30 second step, the same parameters as the cal and doc lanes
// (D-TW-B13: lane-local; a shared module is deferred to a foundation PR).
import { createHmac } from "node:crypto";

export const TOTP_STEP_S = 30;
export const TOTP_DIGITS = 6;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodes an RFC 4648 base32 secret (case-insensitive, padding and spaces ignored). */
export function decodeBase32(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("TEST BUG: secret is not base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The code for one counter value (RFC 4226 HOTP, dynamic truncation). */
export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    ((digest[offset] ?? 0) & 0x7f) * 0x1000000 +
    ((digest[offset + 1] ?? 0) & 0xff) * 0x10000 +
    ((digest[offset + 2] ?? 0) & 0xff) * 0x100 +
    ((digest[offset + 3] ?? 0) & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** The code valid at a unix time in seconds. */
export function totpAt(secret: Buffer, unixSeconds: number): string {
  return hotp(secret, Math.floor(unixSeconds / TOTP_STEP_S));
}
