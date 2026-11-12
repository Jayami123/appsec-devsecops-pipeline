// Private-first redaction for the Playwright JSON that CI uploads (D3, AGENTS.md, master plan section 13).
// A spec whose title, or whose test JSON, names a private-first ID is rebuilt from scratch with only its ID, its
// location, its outcome and its per-project status. Errors, annotations, attachments, steps and stdout are dropped by
// construction, not by filtering. Pure: no file access. Unit-tested in tests/unit/kit/ci/report-redaction.test.ts.
import { privateIdIn } from "../../security/findings.ts";

export interface RedactionResult {
  readonly report: Record<string, unknown>;
  /** Number of specs rebuilt as held-private. Zero means the report had no private-first item. */
  readonly held: number;
  readonly heldIds: readonly string[];
}

const HELD_SUFFIX = " (held-private)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function heldSpec(spec: Record<string, unknown>, id: string): Record<string, unknown> {
  const tests = Array.isArray(spec["tests"]) ? spec["tests"] : [];
  const kept: Record<string, unknown>[] = [];
  for (const node of tests) {
    if (!isRecord(node)) continue;
    kept.push({
      projectName: typeof node["projectName"] === "string" ? node["projectName"] : "(no project)",
      status: node["status"],
      expectedStatus: node["expectedStatus"],
    });
  }
  return {
    title: `${id}${HELD_SUFFIX}`,
    file: spec["file"],
    line: spec["line"],
    column: spec["column"],
    ok: spec["ok"],
    tests: kept,
  };
}

function redactSuite(
  suite: Record<string, unknown>,
  ids: readonly string[],
  heldIds: string[],
): void {
  const title = typeof suite["title"] === "string" ? suite["title"] : "";
  const suiteId = privateIdIn(title, ids);
  if (suiteId !== undefined) suite["title"] = `${suiteId}${HELD_SUFFIX}`;
  if (Array.isArray(suite["specs"])) {
    suite["specs"] = suite["specs"].map((spec: unknown) => {
      if (!isRecord(spec)) return spec;
      const specTitle = typeof spec["title"] === "string" ? spec["title"] : "";
      const id =
        privateIdIn(specTitle, ids) ?? privateIdIn(JSON.stringify(spec["tests"] ?? null), ids);
      if (id === undefined) return spec;
      heldIds.push(id);
      return heldSpec(spec, id);
    });
  }
  if (Array.isArray(suite["suites"])) {
    for (const child of suite["suites"]) if (isRecord(child)) redactSuite(child, ids, heldIds);
  }
}

/** Redacts a parsed Playwright JSON report. Throws for a non-object root (fail closed). */
export function redactPrivateReport(raw: unknown, ids: readonly string[]): RedactionResult {
  if (!isRecord(raw)) throw new Error("Playwright JSON report root must be an object");
  const report = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const heldIds: string[] = [];
  if (Array.isArray(report["suites"])) {
    for (const suite of report["suites"]) if (isRecord(suite)) redactSuite(suite, ids, heldIds);
  }
  // Top-level errors are free text. Drop them when they name a private ID, or whenever anything was held.
  if (
    report["errors"] !== undefined &&
    (heldIds.length > 0 || privateIdIn(JSON.stringify(report["errors"]), ids))
  ) {
    delete report["errors"];
  }
  return { report, held: heldIds.length, heldIds };
}

/**
 * True when a private ID survives anywhere except as the ID of a held-private title. Used as the last check before
 * upload: a surviving ID means the redaction is incomplete, and the caller must stop.
 */
export function privateLeftovers(report: unknown, ids: readonly string[]): string[] {
  const text = JSON.stringify(report);
  const stripped = ids.reduce((acc, id) => acc.split(`${id}${HELD_SUFFIX}`).join(""), text);
  return ids.filter((id) => privateIdIn(stripped, [id]) !== undefined);
}
