// Artefact redaction. The pattern list is a P5 port of the P6 evidence scanner patterns; the line
// citation to the P6 scanner is UNVERIFIED in this repository (the scanner is not vendored here).

const REDACTED = "[REDACTED]";

const TEXT_RULES: readonly [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`],
  [/\bapi_[A-Za-z0-9_-]{8,}/g, `api_${REDACTED}`],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, REDACTED],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, REDACTED],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, REDACTED],
  [/\b(password|secret|token)=[^\s&"'<>]+/gi, `$1=${REDACTED}`],
  [/\b(Authorization|Set-Cookie)\s*:\s*[^\r\n]+/gi, `$1: ${REDACTED}`],
];

/** Redacts credential-shaped text. Ordinary text is returned unchanged. */
export function redactArtefact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TEXT_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
]);

/** Deep copy of a JSON-like value with sensitive keys replaced. The input is never mutated. */
export function redactTraceJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactTraceJson(item));
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redactTraceJson(inner);
    }
    return out;
  }
  return value;
}
