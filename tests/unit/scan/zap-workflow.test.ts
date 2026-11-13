// Shape tests for .github/workflows/p5-zap-nightly.yml (P5-SCAN-004). They read the file as text, as the other
// workflow tests do. No YAML library is a declared dependency of this repository.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO } from "./fixtures/index.ts";

const FILE = ".github/workflows/p5-zap-nightly.yml";
const text = readFileSync(join(REPO, FILE), "utf8");
const DIGEST = "9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af";
const EXTERNAL_USES =
  /uses: [a-z0-9-]+\/[a-z0-9._-]+(\/[a-z0-9._/-]+)?@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;
const ZAP_JOBS = ["zap-cal", "zap-doc", "zap-med", "zap-tw"];

// The text of one top-level job: from its "  <job>:" header to the next job header (or the end of the file).
function jobText(job: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `  ${job}:`);
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^ {2}[a-z0-9-]+:\s*$/.test(lines[end] ?? "")) end += 1;
  return lines.slice(start, end).join("\n");
}

function triggers(): string[] {
  const keys: string[] = [];
  let inOn = false;
  for (const line of text.split("\n")) {
    if (/^on:\s*$/.test(line)) {
      inOn = true;
      continue;
    }
    if (inOn && /^\S/.test(line)) break;
    const key = inOn ? /^ {2}([a-z_]+):/.exec(line) : null;
    if (key) keys.push(key[1] ?? "");
  }
  return keys;
}

test("the triggers are workflow_call (used only by p5-scans on a dispatch) and workflow_dispatch; no schedule until O-10, no pull_request or push", () => {
  assert.deepEqual([...triggers()].sort(), ["workflow_call", "workflow_dispatch"]);
});

test("ci.yml never calls the zap workflow, and the p5-scans hook is dispatch-only and off by default", () => {
  const ci = readFileSync(join(REPO, ".github/workflows/ci.yml"), "utf8");
  assert.doesNotMatch(ci, /p5-zap-nightly/);
  const scans = readFileSync(join(REPO, ".github/workflows/p5-scans.yml"), "utf8");
  assert.match(
    scans,
    /zap_nightly:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: false/,
  );
  assert.match(
    scans,
    /zap-nightly:[\s\S]*?if: github\.event_name == 'workflow_dispatch' && inputs\.zap_nightly\n[\s\S]*?uses: \.\/\.github\/workflows\/p5-zap-nightly\.yml/,
  );
});

test("the top-level permissions are contents: read, and no job grants more", () => {
  assert.match(text, /^permissions:\n {2}contents: read$/m);
  assert.doesNotMatch(text, /contents:\s*write/);
  assert.doesNotMatch(text, /security-events/, "no SARIF upload in this workflow");
});

test("every job is gated on workflow_dispatch, so the schedule starts nothing (O-10)", () => {
  for (const job of ["plan", "zap-control", ...ZAP_JOBS]) {
    const body = jobText(job);
    assert.ok(body.length > 0, `${job} exists`);
    assert.match(body, /^ {4}if: github\.event_name == 'workflow_dispatch'/m, job);
  }
});

test("the product jobs cover the four harness products, one per job", () => {
  const harnessIds = ["cal", "documenso", "medusa", "twenty"];
  const expected: Record<string, string> = {
    "zap-cal": "cal",
    "zap-doc": "documenso",
    "zap-med": "medusa",
    "zap-tw": "twenty",
  };
  for (const [job, id] of Object.entries(expected)) {
    const body = jobText(job);
    assert.match(
      body,
      new RegExp(`up\\.mjs ${id}$`, "m"),
      `${job} starts ${id} through the harness`,
    );
    assert.match(
      body,
      new RegExp(`down\\.mjs ${id}$`, "m"),
      `${job} stops ${id} through the harness`,
    );
    assert.ok(harnessIds.includes(id));
  }
  assert.doesNotMatch(text, /npm run (up|down) --/, "no hand product start through npm run");
});

test("the ZAP image is pinned by tag and digest, and the digest matches the tools.json record", () => {
  assert.match(
    text,
    new RegExp(`ZAP_IMAGE: ghcr\\.io/zaproxy/zaproxy:2\\.17\\.0@sha256:${DIGEST}`),
  );
  const tools = JSON.parse(readFileSync(join(REPO, "config/scan/tools.json"), "utf8")) as {
    tools: { zap?: { sha256?: string; digest?: string } };
  };
  const zap = tools.tools.zap;
  assert.ok(zap, "tools.json has a zap record");
  assert.equal(zap.sha256, DIGEST);
  assert.equal(zap.digest, `sha256:${DIGEST}`);
  assert.doesNotMatch(
    text,
    /zaproxy\/zaproxy:latest|zaproxy\/zaproxy:stable|zaproxy\/zaproxy:weekly/,
  );
});

test("each product scans loopback only, unauthenticated, with the committed rules and the -I flag", () => {
  const targets: Record<string, string> = {
    "zap-cal": "http://127.0.0.1:3000",
    "zap-doc": "http://127.0.0.1:3001",
    "zap-med": "http://127.0.0.1:9000",
    "zap-tw": "http://127.0.0.1:3002",
  };
  for (const job of ZAP_JOBS) {
    const body = jobText(job);
    assert.ok(body.includes(`TARGET: ${targets[job]} `), `${job} target`);
    assert.match(
      body,
      /zap-baseline\.py -t "\$TARGET" -c zap-rules\.tsv -J zap\.json -r zap\.html -m 3 -I/,
      job,
    );
    assert.doesNotMatch(
      body,
      /zap-full-scan|-U |-n |--auth|zap-api-scan/,
      `${job} is passive and unauthenticated`,
    );
    assert.doesNotMatch(body, /\bhttps?:\/\/(?!127\.0\.0\.1)/, `${job} has no external host`);
  }
});

test("the rules file the scan reads exists in the repository", () => {
  assert.match(text, /cp config\/scan\/zap-rules\.tsv /);
  assert.doesNotMatch(text, /sk_live_/);
});

test("the order inside each product job is threshold, evidence gate, upload, stop, then the verdict", () => {
  for (const job of ZAP_JOBS) {
    const body = jobText(job);
    const at = (needle: string): number => {
      const index = body.indexOf(needle);
      assert.ok(index >= 0, `${job}: ${needle}`);
      return index;
    };
    const threshold = at("zap-threshold.ts judge");
    const evidence = at("evidence-token-scan.mjs");
    const privateCheck = at("zap-threshold.ts check-private");
    const upload = at("actions/upload-artifact@");
    const down = at("down.mjs");
    const verdict = at("zap-threshold.ts decide");
    assert.ok(threshold < evidence, `${job}: threshold before PN-7`);
    assert.ok(evidence < privateCheck, `${job}: PN-7 before the private-first check`);
    assert.ok(privateCheck < upload, `${job}: the evidence gate before any upload`);
    assert.ok(upload < down, `${job}: upload before the harness stop`);
    assert.ok(down < verdict, `${job}: the verdict reads the teardown outcome last`);
  }
});

test("the teardown and the verdict run always(), and no step continues on error", () => {
  for (const job of ZAP_JOBS) {
    const body = jobText(job);
    assert.match(body, /id: down\n {8}if: always\(\)/, `${job} stop step`);
    assert.match(body, /Nightly verdict[^\n]*\n {8}if: always\(\)/, `${job} verdict step`);
  }
  assert.doesNotMatch(text, /continue-on-error/);
});

test("the upload is the evidence directory only, for seven days, failing when empty", () => {
  for (const job of ZAP_JOBS) {
    const body = jobText(job);
    assert.match(body, /path: \$\{\{ runner\.temp \}\}\/zap-evidence\//, job);
    assert.match(body, /retention-days: 7/, job);
    assert.match(body, /if-no-files-found: error/, job);
  }
});

test("external actions are full SHAs with a version comment, and there is no docker:// use", () => {
  let checked = 0;
  for (const line of text.split("\n")) {
    if (!/uses:/.test(line) || /uses:\s*\.\//.test(line)) continue;
    checked += 1;
    assert.match(line, EXTERNAL_USES, line.trim());
  }
  assert.ok(checked > 0, "external uses are present");
  assert.doesNotMatch(text, /docker:\/\//);
});

test("no secrets: inherit, no pull_request_target, no workflow_run", () => {
  assert.doesNotMatch(text, /secrets:\s*inherit/);
  assert.doesNotMatch(text, /pull_request_target|workflow_run/);
});

test("every job that runs the harness sets PRODUCTS_ROOT for the job through GITHUB_ENV", () => {
  for (const job of ZAP_JOBS) {
    assert.match(
      jobText(job),
      /echo "PRODUCTS_ROOT=\$RUNNER_TEMP\/products" >> "\$GITHUB_ENV"/,
      job,
    );
  }
});

test("the plan job refuses active mode (D11 is not wired here) and the products need it", () => {
  const plan = jobText("plan");
  assert.match(plan, /if \[ "\$MODE" != "passive" \]/);
  assert.match(plan, /exit 1/);
  for (const job of ZAP_JOBS) assert.match(jobText(job), /needs: \[plan\]/, job);
});

test("the Cal and Medusa lanes keep their secret gates: a test-mode Stripe key and the Medusa admin pair", () => {
  const cal = jobText("zap-cal");
  assert.match(cal, /sk_test_\*\)/);
  assert.match(cal, /STRIPE_API_KEY must be a Stripe test-mode secret key/);
  const med = jobText("zap-med");
  assert.match(
    med,
    /BLOCKED: repository secrets MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD are not set/,
  );
  assert.doesNotMatch(text, /echo "[^"]*\$\{\{ secrets\./, "a secret is never echoed");
});

test("the harness is never driven by npm run up/down/smoke", () => {
  assert.doesNotMatch(text, /npm run (up|down|smoke)/);
});

test("every timeout-minutes is at most 30 for the ZAP jobs (ZAP_NIGHTLY_TIMEOUT_MIN, not raised)", () => {
  for (const match of text.matchAll(/timeout-minutes:\s*(\d+)/g)) {
    assert.ok(Number(match[1]) <= 30, match[1] ?? "");
  }
});

test("the positive-control job requires the four known alerts, uploads nothing and serves loopback only", () => {
  const control = jobText("zap-control");
  assert.match(
    control,
    /zap-threshold\.ts control "\$RUNNER_TEMP\/zap\/zap\.json" 127\.0\.0\.1 8765 10038,10020,10036,10021/,
  );
  assert.doesNotMatch(control, /upload-artifact/);
  assert.match(control, /TARGET: http:\/\/127\.0\.0\.1:8765 /);
  assert.match(control, /--bind 127\.0\.0\.1/);
  assert.doesNotMatch(control, /\bhttps?:\/\/(?!127\.0\.0\.1)/);
});
