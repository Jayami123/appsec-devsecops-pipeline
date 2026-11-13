// Vendored from Jayami123/k6-load-concurrency-suite commit 0533e61 scripts/evidence-token-scan.mjs. Change here only with a reason in the PR.
// Scans evidence files for tokens before they go into a release.
// Prints file, line and the rule label only (the label names the rule; the matched text is never printed).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The three patterns of the Task 8 step 8 grep, then the additions.
/** @type {RegExp[]} */
export const PATTERNS = [
  /api_[A-Za-z0-9]{8,}/,
  /Bearer /,
  /sessionId/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\./,
  /Authorization:/i,
  /\b(?:password|secret|token)=\S+/i,
  /["'](?:authorization|cookie|set-cookie)["']\s*:/i,
  /"(?:password|secret|token|api_key|apiKey)"\s*:\s*"(?:[^"\\]|\\.)+"/i,
  /'(?:password|secret|token|api_key|apiKey)'\s*:\s*'(?:[^'\\]|\\.)+'/i,
];

// One label per PATTERNS entry, in the same order. A label describes the rule shape, never a value.
/** @type {string[]} */
export const RULE_LABELS = [
  "api_ identifier shape",
  "Bearer header text",
  "sessionId name",
  "GitHub token shape (gh prefix)",
  "GitHub fine-grained token shape",
  "JWT shape",
  "Authorization header name",
  "name=value assignment (password, secret or token)",
  "cookie or authorization JSON key",
  "credential JSON key with a value",
  "credential key with a single-quoted value",
];

// Value-free shape of a name=value hit: the keyword, whether it sits in a query string, and coarse classes of the
// value (length bucket and charset). The value itself is never returned or printed.
const ASSIGNMENT = /(?<before>.?)\b(?<key>password|secret|token)=(?<raw>\S+)/i;

/** @param {string} line @returns {{ key: string, position: string, value: string } | null} */
function assignmentOf(line) {
  const match = ASSIGNMENT.exec(line);
  if (match === null || match.groups === undefined) return null;
  const { before = "", key = "", raw = "" } = match.groups;
  // The \S+ capture runs on past a closing JSON quote or a trailing delimiter; those are not part of the value.
  const value = raw.replace(/["'&,;)\]}>]+$/, "");
  const position = before === "?" || before === "&" ? "query" : "other";
  return { key: key.toLowerCase(), position, value };
}

/** @param {string} value @returns {"code" | "opaque" | "mixed"} */
function charsetOf(value) {
  // A JWT-shaped value (eyJ header, dot-separated segments) is a credential, not code, even though it has dots.
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value)) return "opaque";
  if (/[()[\]{};<>"'`+ ]/.test(value) || /^[A-Za-z_$][\w$]*\.[A-Za-z_$]/.test(value)) return "code";
  if (!/^[A-Za-z0-9_\-%.]+$/.test(value)) return "mixed";
  return "opaque";
}

/** @param {string} line @returns {string} */
export function describeAssignment(line) {
  const hit = assignmentOf(line);
  if (hit === null) return "";
  const length = hit.value.length;
  const bucket =
    length < 8
      ? "lt8"
      : length < 16
        ? "8-15"
        : length < 32
          ? "16-31"
          : length < 64
            ? "32-63"
            : "ge64";
  return ` key=${hit.key} position=${hit.position} value=${bucket} charset=${charsetOf(hit.value)}`;
}

/** True for a name=value hit whose value is script code (a false match on page source, not a credential). */
export function isScriptCodeAssignment(line) {
  const hit = assignmentOf(line);
  return hit !== null && charsetOf(hit.value) === "code";
}

/** @param {string} text @returns {{ line: number, rule: string }[]} */
export function findRuleHits(text) {
  /** @type {{ line: number, rule: string }[]} */
  const hits = [];
  text.split("\n").forEach((line, index) => {
    PATTERNS.forEach((pattern, rule) => {
      if (!pattern.test(line)) return;
      if (rule === 7 && isScriptCodeAssignment(line)) return; // narrowed: script code is not a credential
      const detail = rule === 7 ? describeAssignment(line) : "";
      hits.push({ line: index + 1, rule: (RULE_LABELS[rule] ?? "unlabelled rule") + detail });
    });
  });
  return hits;
}

/** @param {string} text @returns {number[]} */
export function findHits(text) {
  return [...new Set(findRuleHits(text).map((hit) => hit.line))];
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** @param {string} root @returns {{ file: string, lines: number[], rules: { line: number, rule: string }[] }[]} */
export function scanTree(root) {
  return listFiles(root)
    .map((file) => {
      const text = readFileSync(file, "utf8");
      const rules = findRuleHits(text);
      return { file: relative(root, file), lines: findHits(text), rules };
    })
    .filter((hit) => hit.lines.length > 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [root] = process.argv.slice(2);
  if (!root) {
    console.error("usage: node scripts/evidence-token-scan.mjs <dir>");
    process.exit(2);
  }
  const hits = scanTree(root);
  for (const { file, rules } of hits)
    for (const { line, rule } of rules)
      console.error(`TOKEN PATTERN: ${file} line ${line} rule ${rule}`);
  if (hits.length > 0) {
    console.error("stop: nothing was uploaded");
    process.exit(1);
  }
  console.log("token scan: clean");
}
