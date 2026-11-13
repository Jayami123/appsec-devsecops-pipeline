import { randomBytes } from "node:crypto";
import { RUN_PREFIX_PATTERN } from "../../kit/run/prefix.ts";

// Throwaway identity helpers (pure). Product routes that create users, log in and mint keys are
// added with the rows that need them (decision D-CAL-B19); this module has no I/O yet.
export class NotThrowawayError extends Error {
  override readonly name = "NotThrowawayError";
}

/** <prefix>-<label>@example.test ; label is [a-z0-9-]{1,20}. */
export function throwawayEmail(prefix: string, label: string): string {
  if (!RUN_PREFIX_PATTERN.test(prefix)) throw new NotThrowawayError("prefix is not a run prefix");
  if (!/^[a-z0-9-]{1,20}$/.test(label))
    throw new NotThrowawayError("label outside [a-z0-9-]{1,20}");
  return `${prefix}-${label}@example.test`;
}

export function assertThrowawayEmail(email: string, prefix: string): void {
  if (!email.startsWith(`${prefix}-`) || !email.endsWith("@example.test")) {
    throw new NotThrowawayError("NOT_THROWAWAY");
  }
}

/** Cal's self-hosted password rule needs upper, lower, digit and symbol (fork ref held by the owner). */
export function throwawayPassword(): string {
  return `Aa1!${randomBytes(24).toString("base64url")}`;
}
