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

/** @param {string} text @returns {{ line: number, rule: string }[]} */
export function findRuleHits(text) {
  /** @type {{ line: number, rule: string }[]} */
  const hits = [];
  text.split("\n").forEach((line, index) => {
    PATTERNS.forEach((pattern, rule) => {
      if (pattern.test(line))
        hits.push({ line: index + 1, rule: RULE_LABELS[rule] ?? "unlabelled rule" });
    });
  });
  return hits;
}

/** @param {string} text @returns {number[]} */
export function findHits(text) {
  /** @type {number[]} */
  const lines = [];
  text.split("\n").forEach((line, index) => {
    if (PATTERNS.some((pattern) => pattern.test(line))) lines.push(index + 1);
  });
  return lines;
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
