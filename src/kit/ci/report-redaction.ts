// Private-first redaction for the Playwright JSON that CI uploads (D3, AGENTS.md, master plan section 13).
// Three passes, in order:
//   1. A spec whose title, or whose test JSON, names a private-first ID is rebuilt from scratch with only its ID, its
//      location, its outcome and its per-project status. Errors, annotations, attachments, steps and stdout are dropped
//      by construction, not by filtering.
//   2. Every other string in the report is checked. Playwright also writes text outside the specs (the root errors,
//      the run configuration and its argv, git metadata, and file paths on suites and specs). A string that names a
//      private ID is replaced by "<ID> (held-private)" and its JSON path is recorded, so the caller can say where.
//   3. The caller runs privateLeftovers() on the result. A key that names an ID is not rewritten by pass 2, so it
//      survives and the caller stops (fail closed).
// Pure: no file access. Unit-tested in tests/unit/kit/ci/report-redaction.test.ts.
import { privateIdIn } from "../../security/findings.ts";

export interface RedactionResult {
  readonly report: Record<string, unknown>;
  /** Number of specs rebuilt as held-private. Zero means no spec named a private-first ID. */
  readonly held: number;
  readonly heldIds: readonly string[];
  /** JSON paths (no values) of strings outside the specs that named a private ID and were rewritten. */
  readonly locations: readonly string[];
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

/** True for a string that is already exactly "<private ID> (held-private)", which pass 2 must leave alone. */
function isHeldMarker(value: string, ids: readonly string[]): boolean {
  return ids.some((id) => value === `${id}${HELD_SUFFIX}`);
}

/**
 * Pass 2: rewrites every string value that names a private ID, at any depth, and records its JSON path. Keys are not
 * rewritten here, so a key that names an ID survives and the leftover check stops the run.
 */
function redactStrings(
  value: unknown,
  ids: readonly string[],
  path: string,
  locations: string[],
): unknown {
  if (typeof value === "string") {
    if (isHeldMarker(value, ids)) return value;
    const found = ids.filter((id) => privateIdIn(value, [id]) !== undefined);
    if (found.length === 0) return value;
    locations.push(path);
    return found.map((id) => `${id}${HELD_SUFFIX}`).join("; ");
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactStrings(item, ids, `${path}[${index}]`, locations));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = redactStrings(item, ids, `${path}.${key}`, locations);
    }
    return out;
  }
  return value;
}

/** Redacts a parsed Playwright JSON report. Throws for a non-object root (fail closed). */
export function redactPrivateReport(raw: unknown, ids: readonly string[]): RedactionResult {
  if (!isRecord(raw)) throw new Error("Playwright JSON report root must be an object");
  const report = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const heldIds: string[] = [];
  if (Array.isArray(report["suites"])) {
    for (const suite of report["suites"]) if (isRecord(suite)) redactSuite(suite, ids, heldIds);
  }
  const locations: string[] = [];
  // Top-level errors are free text. Drop them whenever anything was held. Drop them, and record the location, when
  // they name a private ID.
  if (report["errors"] !== undefined) {
    const namesId = privateIdIn(JSON.stringify(report["errors"]), ids) !== undefined;
    if (heldIds.length > 0 || namesId) delete report["errors"];
    if (namesId) locations.push("$.errors");
  }
  const rewritten = redactStrings(report, ids, "$", locations) as Record<string, unknown>;
  return { report: rewritten, held: heldIds.length, heldIds, locations };
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

/**
 * JSON paths of object keys that name a private ID. A key is not rewritten by redactPrivateReport, so this is how the
 * caller says where a surviving ID sits. Only paths are returned, never values.
 */
export function privateKeyPaths(
  value: unknown,
  ids: readonly string[],
  path = "$",
  out: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => privateKeyPaths(item, ids, `${path}[${index}]`, out));
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (privateIdIn(key, ids) !== undefined) out.push(`${path}.${key}`);
      privateKeyPaths(item, ids, `${path}.${key}`, out);
    }
  }
  return out;
}
