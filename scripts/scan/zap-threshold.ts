// ZAP passive nightly verdict (P5-SCAN-004; plan 6.7 as tightened for the nightly lane).
//
// Subcommands (run as: node --experimental-strip-types scripts/scan/zap-threshold.ts <subcommand> ...):
//   judge <zap.json> <product> <target-host> <target-port> <scan-exit> <summary.md> [auth-proof-part]
//       Prints verdict=pass|fail on stdout (for $GITHUB_OUTPUT) and writes the summary markdown.
//       Exit 0 for a computed verdict. Exit 1 for unusable input (missing, malformed or unexpected JSON, a scan
//       that did not exit 0, no site for the target, a failed auth proof).
//   check-private <dir> <ledger.json>
//       Exit 0 when no private-first ID from the ledger appears in any file under dir. Exit 1 otherwise and
//       names the file only, never the ID.
//   control <zap.json> <target-host> <target-port> <alert-ids,comma-separated>
//       The positive control (a local page with known header gaps). Exit 0 only when every listed alert ID is
//       reported for the target. Exit 1 otherwise, which means the scanner did not report what it must.
//   decide <scan> <judge-outcome> <judge-verdict> <evidence> <teardown>
//       Exit 0 only when every input is a success and the verdict is pass. Exit 1 otherwise.
//
// Fail-closed rules: a scan that did not run, a missing or malformed zap.json, absent expected fields, a teardown
// that failed, or an unproven authenticated session each end the nightly job as a failure. Upload success is never
// the verdict. Only a new alert type (not in config/scan/baseline/zap.json, or with an expired baseline entry) fails
// the nightly job; a known alert type is annotated and passes. Nothing here prints a secret, a cookie or a token.
import { appendFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { privateIdIn, privateIdsOf } from "../../src/security/findings.ts";
import { activeFingerprints, isExpired, parseBaseline, type Baseline } from "./threshold-core.ts";

export const RISK_LABELS: Readonly<Record<string, string>> = {
  "0": "Informational",
  "1": "Low",
  "2": "Medium",
  "3": "High",
};

export class ZapInputError extends Error {
  override readonly name = "ZapInputError";
}

export interface ZapAlert {
  readonly pluginid: string;
  readonly name: string;
  readonly riskcode: string;
  readonly instances: readonly { readonly uri: string }[];
}
export interface ZapSite {
  readonly host: string;
  readonly port: string;
  readonly alerts: readonly ZapAlert[];
}
export interface ZapReport {
  readonly version: string;
  readonly sites: readonly ZapSite[];
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ZapInputError(`zap.json: ${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") {
    throw new ZapInputError(`zap.json: ${label} is missing or empty`);
  }
  return value;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new ZapInputError(`zap.json: ${label} is not an array`);
  return value;
}

// Parses the ZAP JSON document (field names taken from the pinned image, ZAP 2.17.0, zap-baseline.py -J output).
// Throws ZapInputError on any missing or wrongly typed field. Never returns a partial report.
export function parseReport(text: string): ZapReport {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new ZapInputError("zap.json is not valid JSON");
  }
  const top = asObject(doc, "document");
  const version = asText(top["@version"], "@version");
  const sites = asArray(top["site"], "site").map((raw, index) => {
    const site = asObject(raw, `site ${index}`);
    const alerts = asArray(site["alerts"], `site ${index} alerts`).map((alertRaw, alertIndex) => {
      const alert = asObject(alertRaw, `alert ${alertIndex}`);
      const pluginid = asText(alert["pluginid"], "alert pluginid");
      if (!/^\d+$/.test(pluginid))
        throw new ZapInputError("zap.json: alert pluginid is not numeric");
      const riskcode = asText(alert["riskcode"], "alert riskcode");
      if (!Object.hasOwn(RISK_LABELS, riskcode)) {
        throw new ZapInputError("zap.json: alert riskcode is unknown");
      }
      const instances = asArray(alert["instances"], "alert instances").map((instanceRaw) => ({
        uri: asText(asObject(instanceRaw, "alert instance")["uri"], "instance uri"),
      }));
      return {
        pluginid,
        name: asText(alert["name"], "alert name"),
        riskcode,
        instances,
      };
    });
    return {
      host: asText(site["@host"], "site @host"),
      port: asText(site["@port"], "site @port"),
      alerts,
    };
  });
  return { version, sites };
}

export interface JudgeInput {
  readonly product: string;
  readonly targetHost: string;
  readonly targetPort: string;
  readonly scanExit: number;
  readonly baseline: Baseline;
  readonly nowIso: string;
  // Authenticated mode only: a substring that must appear in an alert instance URI (the proof that the session
  // reached a logged-in-only page). Undefined for an unauthenticated product (every product in this PR).
  readonly authProof?: string;
}

export interface AlertType {
  readonly fingerprint: string;
  readonly pluginid: string;
  readonly name: string;
  readonly risk: string;
  readonly instances: number;
  readonly known: boolean;
}

export interface Judgement {
  readonly verdict: "pass" | "fail";
  readonly reasons: readonly string[];
  readonly types: readonly AlertType[];
  readonly newTypes: readonly AlertType[];
  readonly expiredKnown: readonly string[];
  readonly staleKnown: readonly string[];
  readonly countsByRisk: Readonly<Record<string, number>>;
  readonly insightErrors: number;
}

export function fingerprintOf(product: string, pluginid: string): string {
  return `${product}|${pluginid}`;
}

// The verdict for one product's scan. Throws ZapInputError when the input cannot support a verdict.
export function judge(text: string, input: JudgeInput): Judgement {
  if (!Number.isInteger(input.scanExit))
    throw new ZapInputError("scan exit code is not an integer");
  if (input.scanExit !== 0) {
    throw new ZapInputError(
      `the ZAP scan exited ${input.scanExit}; no verdict from a scan that did not run`,
    );
  }
  const report = parseReport(text);
  const sites = report.sites.filter(
    (site) => site.host === input.targetHost && site.port === input.targetPort,
  );
  if (sites.length === 0) {
    throw new ZapInputError("zap.json has no site for the scan target host and port");
  }

  const byPlugin = new Map<string, { name: string; risk: string; instances: number }>();
  for (const site of sites) {
    for (const alert of site.alerts) {
      const seen = byPlugin.get(alert.pluginid);
      const instances = alert.instances.length;
      if (seen === undefined) {
        byPlugin.set(alert.pluginid, { name: alert.name, risk: alert.riskcode, instances });
      } else {
        seen.instances += instances;
        if (Number(alert.riskcode) > Number(seen.risk)) seen.risk = alert.riskcode;
      }
    }
  }

  const active = activeFingerprints(input.baseline, input.nowIso);
  const types: AlertType[] = [...byPlugin.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pluginid, info]) => {
      const fingerprint = fingerprintOf(input.product, pluginid);
      return {
        fingerprint,
        pluginid,
        name: info.name,
        risk: RISK_LABELS[info.risk] ?? "Unknown",
        instances: info.instances,
        known: active.has(fingerprint),
      };
    });

  const current = new Set(types.map((type) => type.fingerprint));
  const productEntries = input.baseline.entries.filter((entry) =>
    entry.fingerprint.startsWith(`${input.product}|`),
  );
  const expiredKnown = productEntries
    .filter((entry) => isExpired(entry.expires, input.nowIso))
    .map((entry) => entry.fingerprint);
  const staleKnown = productEntries
    .map((entry) => entry.fingerprint)
    .filter((fingerprint) => !current.has(fingerprint));

  const countsByRisk: Record<string, number> = {
    High: 0,
    Medium: 0,
    Low: 0,
    Informational: 0,
    Unknown: 0,
  };
  for (const type of types) countsByRisk[type.risk] = (countsByRisk[type.risk] ?? 0) + 1;

  const reasons: string[] = [];
  const newTypes = types.filter((type) => !type.known);
  if (newTypes.length > 0) {
    reasons.push(
      `${newTypes.length} new alert type(s) above the committed baseline: ${newTypes
        .map((type) => `${type.pluginid} ${type.name} (${type.risk})`)
        .join("; ")}`,
    );
  }
  if (input.authProof !== undefined) {
    const proven = sites.some((site) =>
      site.alerts.some((alert) =>
        alert.instances.some((instance) => instance.uri.includes(input.authProof ?? "")),
      ),
    );
    if (!proven) {
      reasons.push("authenticated mode: the logged-in proof URL is not in the ZAP site tree");
    }
  }

  return {
    verdict: reasons.length === 0 ? "pass" : "fail",
    reasons,
    types,
    newTypes,
    expiredKnown,
    staleKnown,
    countsByRisk,
    insightErrors: insightErrorCount(JSON.parse(text) as unknown),
  };
}

// ZAP logs its own errors into insights (insight.log.error). Annotated in the summary, not a verdict input.
function insightErrorCount(document: unknown): number {
  const top = asObject(document, "document");
  const insights = top["insights"];
  if (!Array.isArray(insights)) return 0;
  for (const raw of insights) {
    const insight = asObject(raw, "insight");
    if (insight["key"] === "insight.log.error") {
      const count = Number(insight["statistic"]);
      return Number.isFinite(count) ? count : 0;
    }
  }
  return 0;
}

// The positive control: every required alert ID must be reported for the target. Throws ZapInputError on unusable
// input. Returns the IDs that are missing (an empty list is a pass).
export function requireAlerts(
  text: string,
  targetHost: string,
  targetPort: string,
  requiredIds: readonly string[],
): string[] {
  const report = parseReport(text);
  const reported = new Set<string>();
  for (const site of report.sites) {
    if (site.host !== targetHost || site.port !== targetPort) continue;
    for (const alert of site.alerts) reported.add(alert.pluginid);
  }
  return requiredIds.filter((id) => !reported.has(id));
}

export function summaryMarkdown(
  product: string,
  judgement: Judgement,
  targetLabel: string,
): string {
  const lines: string[] = [];
  lines.push(`### P5-SCAN-004 ZAP passive baseline: ${product}`);
  lines.push("");
  lines.push(`Target: ${targetLabel} (loopback, unauthenticated, passive baseline).`);
  lines.push(`Job verdict from the threshold: **${judgement.verdict.toUpperCase()}**.`);
  for (const reason of judgement.reasons) lines.push(`- ${reason}`);
  lines.push("");
  lines.push("| risk | alert types | instances |");
  lines.push("| --- | --- | --- |");
  for (const risk of ["High", "Medium", "Low", "Informational", "Unknown"]) {
    const instances = judgement.types
      .filter((type) => type.risk === risk)
      .reduce((sum, type) => sum + type.instances, 0);
    lines.push(`| ${risk} | ${judgement.countsByRisk[risk] ?? 0} | ${instances} |`);
  }
  lines.push("");
  lines.push("| alert id | name | risk | instances | baseline |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const type of judgement.types) {
    lines.push(
      `| ${type.pluginid} | ${type.name.replace(/\|/g, "/")} | ${type.risk} | ${type.instances} | ${
        type.known ? "known" : "NEW"
      } |`,
    );
  }
  if (judgement.expiredKnown.length > 0) {
    lines.push("");
    lines.push(`Expired baseline entries (count as NEW): ${judgement.expiredKnown.length}.`);
  }
  if (judgement.staleKnown.length > 0) {
    lines.push("");
    lines.push(
      `Baseline entries not seen in this run: ${judgement.staleKnown.length} (annotated; spider coverage varies by run).`,
    );
  }
  if (judgement.insightErrors > 0) {
    lines.push("");
    lines.push(`ZAP logged ${judgement.insightErrors} error(s) (annotated; not a verdict input).`);
  }
  lines.push("");
  return lines.join("\n");
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// Names of the files under dir that carry a private-first ID from the ledger. Never returns the ID itself.
export function privateLeaks(dir: string, ledgerText: string): string[] {
  let ledger: unknown;
  try {
    ledger = JSON.parse(ledgerText) as unknown;
  } catch {
    throw new ZapInputError("the findings ledger is not valid JSON");
  }
  const ids = privateIdsOf(ledger);
  const leaks: string[] = [];
  for (const file of listFiles(dir)) {
    if (privateIdIn(readFileSync(file, "utf8"), ids) !== undefined) {
      leaks.push(relative(dir, file));
    }
  }
  return leaks;
}

export interface Decision {
  readonly verdict: "pass" | "fail";
  readonly reason: string;
}

export function decide(input: {
  readonly scan: string;
  readonly judgeOutcome: string;
  readonly judgeVerdict: string;
  readonly evidence: string;
  readonly teardown: string;
}): Decision {
  const failures: string[] = [];
  if (input.scan !== "success") failures.push(`the scan step ${input.scan}`);
  if (input.judgeOutcome !== "success") failures.push(`the threshold step ${input.judgeOutcome}`);
  else if (input.judgeVerdict !== "pass") failures.push("the threshold verdict is fail");
  if (input.evidence !== "success") failures.push(`the evidence gate ${input.evidence}`);
  if (input.teardown !== "success") failures.push(`the harness teardown ${input.teardown}`);
  if (failures.length === 0) return { verdict: "pass", reason: "all gates passed" };
  return { verdict: "fail", reason: failures.join("; ") };
}

function fail(message: string): never {
  process.stderr.write(`zap-threshold: ${message}\n`);
  process.exit(1);
}

function main(argv: string[]): number {
  const [command, ...args] = argv;
  if (command === "judge") {
    const [file, product, host, port, exit, summaryPath, authProof] = args;
    if (!file || !product || !host || !port || exit === undefined || !summaryPath) {
      fail(
        "usage: judge <zap.json> <product> <target-host> <target-port> <scan-exit> <summary.md> [auth-proof]",
      );
    }
    const baseline = parseBaseline(
      readFileSync(
        fileURLToPath(new URL("../../config/scan/baseline/zap.json", import.meta.url)),
        "utf8",
      ),
      "zap",
    );
    try {
      const judgement = judge(readFileSync(file, "utf8"), {
        product,
        targetHost: host,
        targetPort: port,
        scanExit: Number(exit),
        baseline,
        nowIso: new Date().toISOString(),
        ...(authProof !== undefined && authProof !== "" ? { authProof } : {}),
      });
      writeFileSync(summaryPath, summaryMarkdown(product, judgement, `${host}:${port}`));
      for (const reason of judgement.reasons) process.stderr.write(`zap-threshold: ${reason}\n`);
      process.stdout.write(`verdict=${judgement.verdict}\n`);
      return 0;
    } catch (cause) {
      if (cause instanceof ZapInputError) fail(cause.message);
      throw cause;
    }
  }
  if (command === "check-private") {
    const [dir, ledgerPath] = args;
    if (!dir || !ledgerPath) fail("usage: check-private <dir> <ledger.json>");
    let ledgerText: string;
    try {
      ledgerText = readFileSync(ledgerPath, "utf8");
    } catch {
      fail("the findings ledger cannot be read; nothing is uploaded");
    }
    const leaks = privateLeaks(dir, ledgerText);
    if (leaks.length > 0) {
      for (const file of leaks) process.stderr.write(`PRIVATE-FIRST ID FOUND in ${file}\n`);
      process.stderr.write("stop: nothing is uploaded\n");
      return 1;
    }
    process.stdout.write("private-first check: clean\n");
    return 0;
  }
  if (command === "control") {
    const [file, host, port, ids] = args;
    if (!file || !host || !port || !ids) {
      fail("usage: control <zap.json> <target-host> <target-port> <alert-ids>");
    }
    const required = ids.split(",").filter((id) => id !== "");
    try {
      const missing = requireAlerts(readFileSync(file, "utf8"), host, port, required);
      if (missing.length > 0) {
        process.stderr.write(`positive control: alert id(s) not reported: ${missing.join(", ")}\n`);
        process.stdout.write("control=fail\n");
        return 1;
      }
      process.stdout.write("control=pass\n");
      return 0;
    } catch (cause) {
      if (cause instanceof ZapInputError) fail(cause.message);
      throw cause;
    }
  }
  if (command === "decide") {
    const [scan, judgeOutcome, judgeVerdict, evidence, teardown] = args;
    const decision = decide({
      scan: scan ?? "",
      judgeOutcome: judgeOutcome ?? "",
      judgeVerdict: judgeVerdict ?? "",
      evidence: evidence ?? "",
      teardown: teardown ?? "",
    });
    process.stdout.write(`${decision.verdict}: ${decision.reason}\n`);
    if (process.env["GITHUB_STEP_SUMMARY"] !== undefined) {
      appendFileSync(
        process.env["GITHUB_STEP_SUMMARY"],
        `\n**Nightly job verdict: ${decision.verdict.toUpperCase()}** (${decision.reason})\n`,
      );
    }
    return decision.verdict === "pass" ? 0 : 1;
  }
  fail("usage: zap-threshold.ts judge|check-private|decide ...");
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
