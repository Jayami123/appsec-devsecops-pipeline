// Keeps credentials out of CI output (D-DOC-B51). Playwright appends a call log that echoes every request header
// (including `cookie:` from the session jar) to errors such as ECONNREFUSED. guardRequest rethrows those errors with
// the call log removed and every credential-shaped value masked. The masking is applied to every error, so it
// also covers a token that a spec passes in a per-request header.
import type { APIRequestContext } from "@playwright/test";
import { redactArtefact } from "../../security/redact.ts";

const CALL_LOG = /\n\s*Call log:[\s\S]*$/;
const HEADER = /\b(cookie|set-cookie|authorization)\s*:[^\n]*/gi;
const SESSION = /\b(sessionId|csrfToken)=[^;\s'",]+/g;

/** The message with the Playwright call log removed and credential-shaped values masked. Pure. */
export function sanitizeRequestError(message: string): string {
  const noCallLog = message.replace(CALL_LOG, "\n[call log removed]");
  const masked = noCallLog
    .replace(HEADER, (_m, name: string) => `${name}: [REDACTED]`)
    .replace(SESSION, (_m, name: string) => `${name}=[REDACTED]`);
  return redactArtefact(masked);
}

/** Wraps an APIRequestContext so every rejected call rethrows a sanitized Error. Returns a proxy; the original is not changed. */
export function guardRequest(request: APIRequestContext): APIRequestContext {
  return new Proxy(request, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
        if (!(result instanceof Promise)) return result;
        return result.catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(sanitizeRequestError(message));
        });
      };
    },
  });
}
