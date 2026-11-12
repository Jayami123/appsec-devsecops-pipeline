// Prepares one Playwright invocation's report for upload (D3, AGENTS.md "Secrets, artefacts and privacy").
// Usage: node scripts/prepare-ci-artifacts.ts <label> <raw.json> <out.json>
//   - Reads the private-first IDs from docs/findings/ledger.json (fail closed when that cannot be read).
//   - Writes <out.json>: the report with every spec that names a private-first ID rebuilt as ID and status only.
//   - When a private-first spec ran, removes playwright-report/ and test-results/ from the workspace. Their error
//     text cannot be redacted per title, so they are not uploaded for that job.
//   - A private ID that survives redaction stops the run (fail closed); nothing is written.
// Exit codes: 0 = written, or the raw report is missing (a warning is printed and nothing is written);
//   1 = wrong argument count, unreadable ledger or JSON, a surviving private ID, or a redaction failure.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { redactPrivateReport, privateLeftovers } from "../src/kit/ci/report-redaction.ts";
import { privateIdsOf } from "../src/security/findings.ts";

const LEDGER = "docs/findings/ledger.json";
const args = process.argv.slice(2);

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (args.length !== 3) fail("usage: prepare-ci-artifacts.ts <label> <raw.json> <out.json>");
const [label, rawPath, outPath] = args as [string, string, string];

let privateIds: string[];
try {
  privateIds = privateIdsOf(JSON.parse(readFileSync(LEDGER, "utf8")));
} catch (cause) {
  fail(
    `cannot read the private-first IDs from ${LEDGER}: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
}

if (!existsSync(rawPath)) {
  process.stdout.write(
    `::warning::No raw Playwright JSON at ${rawPath} for ${label}; nothing was prepared for upload.\n`,
  );
  process.exit(0);
}

let redacted: ReturnType<typeof redactPrivateReport>;
try {
  redacted = redactPrivateReport(JSON.parse(readFileSync(rawPath, "utf8")), privateIds);
} catch (cause) {
  fail(
    `${rawPath} could not be redacted: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
}

const leftovers = privateLeftovers(redacted.report, privateIds);
if (leftovers.length > 0) {
  // Fail closed: a surviving private ID means the redaction is incomplete. Write nothing.
  fail(
    `redaction incomplete for ${label}: a private-first ID survives outside its held title (${leftovers.length} ID(s))`,
  );
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(redacted.report, null, 2)}\n`, "utf8");

if (redacted.held > 0) {
  // The HTML report and the failure output embed the raw error text of every test, so they are not uploaded.
  rmSync("playwright-report", { recursive: true, force: true });
  rmSync("test-results", { recursive: true, force: true });
  process.stdout.write(
    `::notice::${label}: ${redacted.held} held-private spec(s) ran; the HTML report and test results are not uploaded for this job.\n`,
  );
}
process.stdout.write(
  `${label}: sanitised report written (${redacted.held} held-private spec(s)).\n`,
);
