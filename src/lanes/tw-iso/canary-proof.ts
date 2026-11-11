// P-12 canary presence proof (D-P12, D-TWISO-B4; tw-iso.md section 6; master plan P-12 MP:859).
// Runs INSTEAD of a bare `up` for twenty. The canary value is generated in memory, handed to up through
// its environment only, and never printed, written to disk or placed in $GITHUB_ENV. Only booleans and
// fixed strings reach the proof record.
//
// Limitation (recorded in the build log): this shows the canary reached compose through the harness
// named-canary route, by construction and by the override file. It does not observe the container.
// No container exec and no docker inspect (D-P12).
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RUN_PREFIX_PATTERN } from "../../kit/run/prefix.ts";

export const CANARY_NAME_PREFIX = "P5_CANARY_";
export const CANARY_NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
export const PROOF_PATH = join("results", "tw-iso", "p12-proof.json");
const HARNESS_DIR = resolve("node_modules", "qa-portfolio-harness");
// smoke.mjs runs up (smoke.mjs:178), then seed (smoke.mjs:189), then the auth checks, in ONE process with the
// canary environment. up.mjs does not seed (no seed call in scripts/up.mjs), and a second up would rewrite the
// override file without the canary line. Decision D-TWISO-B13.
const UP_SCRIPT = join(HARNESS_DIR, "scripts", "smoke.mjs");
const OVERRIDE_FILE = join(HARNESS_DIR, ".harness", "twenty.runtime.compose.yml");
const LOGIC_FUNCTION_TYPE = "LOCAL";
const METHOD = "parent-side, harness named-canary route, no exec";

export interface ProofRecord {
  readonly proof: "P-12";
  readonly upExit0: boolean;
  readonly overrideHasServerRef: boolean;
  readonly overrideHasWorkerRef: boolean;
  readonly overrideHasNoValue: boolean;
  readonly hashMatch: boolean;
  readonly method: string;
  readonly logicFunctionType: string;
}

/** Pure: the canary name for a run, `P5_CANARY_` plus the run id upper-cased with dashes as underscores. */
export function canaryName(runId: string): string {
  if (!RUN_PREFIX_PATTERN.test(runId)) {
    throw new Error("TEST BUG: run id does not match RUN_PREFIX_PATTERN");
  }
  const name = CANARY_NAME_PREFIX + runId.toUpperCase().replace(/-/g, "_");
  if (!CANARY_NAME_PATTERN.test(name)) {
    throw new Error("TEST BUG: canary name fails the harness pattern");
  }
  return name;
}

/**
 * Pure: reads the override file text by service block. True for a service only when the reference line
 * `<NAME>: ${HARNESS_TWENTY_CANARY_VALUE}` sits under that service. noValue is true only when the value
 * is absent from the whole file.
 */
export function overrideCheck(
  fileText: string,
  name: string,
  value: string,
): { serverRef: boolean; workerRef: boolean; noValue: boolean } {
  const reference = `${name}: \${HARNESS_TWENTY_CANARY_VALUE}`;
  const found: Record<"server" | "worker", boolean> = { server: false, worker: false };
  let service: "server" | "worker" | undefined;
  for (const line of fileText.split("\n")) {
    const header = /^ {2}(server|worker):\s*$/.exec(line);
    if (header) {
      service = header[1] as "server" | "worker";
      continue;
    }
    if (/^\S/.test(line)) service = undefined;
    if (service !== undefined && line.trim() === reference) found[service] = true;
  }
  return {
    serverRef: found.server,
    workerRef: found.worker,
    noValue: value.length > 0 && !fileText.includes(value),
  };
}

/** Pure: the record written to results/tw-iso/p12-proof.json. Booleans and fixed strings only. */
export function proofRecord(parts: {
  upExit0: boolean;
  check: { serverRef: boolean; workerRef: boolean; noValue: boolean };
  hashMatch: boolean;
}): ProofRecord {
  return {
    proof: "P-12",
    upExit0: parts.upExit0,
    overrideHasServerRef: parts.check.serverRef,
    overrideHasWorkerRef: parts.check.workerRef,
    overrideHasNoValue: parts.check.noValue,
    hashMatch: parts.hashMatch,
    method: METHOD,
    logicFunctionType: LOGIC_FUNCTION_TYPE,
  };
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Runs the proof. Returns up's exit code. Nothing secret is printed. */
export async function runProof(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const runId = env.P5_RUN_ID?.trim() ?? "";
  const name = canaryName(runId);
  const value = randomBytes(32).toString("hex");
  const valueHash = sha256(value);
  // E is the whole environment of up. The harness passes {...process.env} to compose (twenty.adapter.ts:83-87).
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    LOGIC_FUNCTION_TYPE,
    HARNESS_TWENTY_CANARY_NAME: name,
    HARNESS_TWENTY_CANARY_VALUE: value,
  };
  const logDir = mkdtempSync(join(env.RUNNER_TEMP ?? tmpdir(), "p5-tw-iso-up-"));
  const logFd = openSync(join(logDir, "up.log"), "a", 0o600);
  const upExit = await new Promise<number>((done) => {
    const child = spawn(process.execPath, [UP_SCRIPT, "twenty"], {
      env: childEnv,
      stdio: ["ignore", logFd, logFd],
    });
    child.on("error", () => {
      done(1);
    });
    child.on("exit", (code) => {
      done(code ?? 1);
    });
  });
  // The value handed to up is the one in childEnv; compare its hash with the hash generated above.
  const hashMatch = sha256(childEnv.HARNESS_TWENTY_CANARY_VALUE ?? "") === valueHash;
  const overrideText = existsSync(OVERRIDE_FILE) ? readFileSync(OVERRIDE_FILE, "utf8") : "";
  const record = proofRecord({
    upExit0: upExit === 0,
    check: overrideCheck(overrideText, name, value),
    hashMatch,
  });
  mkdirSync(join("results", "tw-iso"), { recursive: true });
  writeFileSync(PROOF_PATH, `${JSON.stringify(record, null, 2)}\n`);
  return upExit;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  runProof().then(
    (code) => process.exit(code),
    () => {
      process.stderr.write(
        "TEST BUG or ENV: canary proof could not start (see the proof record).\n",
      );
      process.exit(1);
    },
  );
}
