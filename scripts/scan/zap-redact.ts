// Sanitise ZAP report artefacts before the evidence gate (P5-SCAN-004, F-ZAP-1).
// Redacts the VALUE of a sensitive query, form or JSON key to "[REDACTED]" and keeps the key name, the URL and the
// rest of the text. It never prints a value. It does not touch the evidence gate (evidence-token-scan.mjs), which
// still runs on the output and still fails on any credential-shaped text it finds anywhere else.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Sensitive key names (case-insensitive). A key matches only as a whole name: "postcode" is not "code".
export const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "client_secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apikey",
  "session",
  "sessionid",
  "sid",
  "code",
  "otp",
  "auth",
  "authorization",
  "credential",
  "credentials",
  "pin",
  "signature",
];
const KEY_ALTERNATION = SENSITIVE_KEYS.join("|");

// key=value in a URL query or a form body. The value runs to the next &, #, whitespace or quote.
const QUERY_OR_FORM = new RegExp(`(?<![A-Za-z0-9])(${KEY_ALTERNATION})=([^&#\\s"'<>\\\\]+)`, "gi");
// "key": "value" in a JSON document. The value is a JSON string.
const JSON_KEY = new RegExp(`"(${KEY_ALTERNATION})"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "gi");

export const REDACTED = "[REDACTED]";

export function redactText(text: string): { text: string; count: number } {
  let count = 0;
  let out = text.replace(QUERY_OR_FORM, (_m, key) => {
    count += 1;
    return `${key}=${REDACTED}`;
  });
  out = out.replace(JSON_KEY, (_m, key) => {
    count += 1;
    return `"${key}": "${REDACTED}"`;
  });
  return { text: out, count };
}

// The artefacts that leave the runner (and the one the gate reads). Each is rewritten in place.
export const ARTEFACTS: readonly string[] = ["zap.json", "zap.html", "zap-summary.md"];

export function redactDirectory(dir: string): { file: string; count: number }[] {
  const results: { file: string; count: number }[] = [];
  for (const name of ARTEFACTS) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    const { text, count } = redactText(readFileSync(path, "utf8"));
    writeFileSync(path, text);
    results.push({ file: name, count });
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    console.error("usage: zap-redact.mjs <evidence-dir>");
    process.exit(2);
  }
  const results = redactDirectory(dir);
  // Counts only. No value is printed.
  for (const { file, count } of results) console.log(`redacted ${count} value(s) in ${file}`);
}
