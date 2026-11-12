// Private-first redaction outside the specs (D3). Each test plants a neutral sentinel next to a private ID in one
// location Playwright writes outside the specs, and proves the location is rewritten or, for a key, still caught.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { privateLeftovers, redactPrivateReport } from "../../../../src/kit/ci/report-redaction.ts";

const GQL = "P5-TW-GQL-002";
const PF = "P5-DOC-PF-001";
const IDS = [GQL, PF];
const SENTINEL = "SENTINEL-EVIDENCE";

/** A report shaped like Playwright's JSON: run configuration, git metadata, one suite and one public spec. */
function report(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    config: {
      argv: ["node", "playwright", "test", "--project=cal-api"],
      rootDir: "/repo",
      metadata: { gitCommit: { id: "abc123", subject: "docs: plain subject" } },
    },
    suites: [
      {
        title: "plain.spec.ts",
        file: "tests/plain.spec.ts",
        specs: [
          {
            title: "P5-CAL-AUTHZ-001 owner booking",
            file: "tests/plain.spec.ts",
            line: 1,
            column: 1,
            ok: true,
            tests: [
              {
                projectName: "cal-api",
                status: "expected",
                expectedStatus: "passed",
                annotations: [],
              },
            ],
          },
        ],
        suites: [],
      },
    ],
    stats: { expected: 1, unexpected: 0 },
    ...overrides,
  };
}

function rewrittenAt(path: string, value: unknown): unknown {
  return (value as Record<string, unknown>)[path];
}

describe("fields outside the specs are rewritten at the source (D3)", () => {
  test("F1 an ID in the run argv is rewritten, and its JSON path is reported", () => {
    const raw = report();
    (raw["config"] as Record<string, unknown>)["argv"] = [
      "node",
      "playwright",
      `${GQL} ${SENTINEL}`,
    ];
    const result = redactPrivateReport(raw, IDS);
    assert.deepEqual(result.locations, ["$.config.argv[2]"]);
    const argv = (result.report["config"] as Record<string, unknown>)["argv"] as string[];
    assert.equal(argv[2], `${GQL} (held-private)`);
    assert.doesNotMatch(JSON.stringify(result.report), new RegExp(SENTINEL));
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
  });

  test("F2 an ID in git metadata (commit subject) is rewritten", () => {
    const raw = report();
    (raw["config"] as Record<string, unknown>)["metadata"] = {
      gitCommit: { id: "abc123", subject: `${PF} ${SENTINEL}` },
    };
    const result = redactPrivateReport(raw, IDS);
    assert.deepEqual(result.locations, ["$.config.metadata.gitCommit.subject"]);
    assert.doesNotMatch(JSON.stringify(result.report), new RegExp(SENTINEL));
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
  });

  test("F3 an ID in a suite file path is rewritten", () => {
    const raw = report();
    const suite = (raw["suites"] as Record<string, unknown>[])[0] as Record<string, unknown>;
    suite["file"] = `tests/${GQL}/plain.spec.ts`;
    const result = redactPrivateReport(raw, IDS);
    assert.deepEqual(result.locations, ["$.suites[0].file"]);
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
  });

  test("F4 an ID in a public spec's file path is rewritten, and no spec is held", () => {
    const raw = report();
    const spec = ((raw["suites"] as Record<string, unknown>[])[0] as Record<string, unknown>)[
      "specs"
    ] as Record<string, unknown>[];
    (spec[0] as Record<string, unknown>)["file"] = `tests/${PF}.spec.ts`;
    const result = redactPrivateReport(raw, IDS);
    assert.equal(result.held, 0);
    assert.deepEqual(result.locations, ["$.suites[0].specs[0].file"]);
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
  });

  test("F5 root errors that name an ID are removed, and the removal is reported", () => {
    const raw = report({ errors: [{ message: `${GQL} ${SENTINEL}` }] });
    const result = redactPrivateReport(raw, IDS);
    assert.equal("errors" in result.report, false);
    assert.deepEqual(result.locations, ["$.errors"]);
    assert.doesNotMatch(JSON.stringify(result.report), new RegExp(SENTINEL));
  });

  test("F6 a string that names two IDs is rewritten to both markers", () => {
    const raw = report();
    (raw["config"] as Record<string, unknown>)["argv"] = [`${GQL} and ${PF} ${SENTINEL}`];
    const result = redactPrivateReport(raw, IDS);
    assert.equal(
      rewrittenAt("0", (result.report["config"] as Record<string, unknown>)["argv"]),
      `${GQL} (held-private); ${PF} (held-private)`,
    );
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
  });

  test("F7 an ID used as an object KEY is not rewritten, so the leftover check still catches it", () => {
    const raw = report();
    (raw["config"] as Record<string, unknown>)[GQL] = { note: "x" };
    const result = redactPrivateReport(raw, IDS);
    assert.deepEqual(result.locations, []);
    assert.deepEqual(privateLeftovers(result.report, IDS), [GQL]);
  });
});

describe("a lane with no held item passes (D3)", () => {
  test("F8 a clean report has no held spec, no rewritten field and no leftover, and is returned unchanged", () => {
    const raw = report();
    const result = redactPrivateReport(raw, IDS);
    assert.equal(result.held, 0);
    assert.deepEqual(result.heldIds, []);
    assert.deepEqual(result.locations, []);
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
    assert.deepEqual(result.report, JSON.parse(JSON.stringify(raw)));
  });

  test("F9 a held spec's own marker is not counted as a rewritten field", () => {
    const raw = report();
    const spec = ((raw["suites"] as Record<string, unknown>[])[0] as Record<string, unknown>)[
      "specs"
    ] as Record<string, unknown>[];
    (spec[0] as Record<string, unknown>)["title"] = `${GQL} held title`;
    const result = redactPrivateReport(raw, IDS);
    assert.equal(result.held, 1);
    assert.deepEqual(result.locations, []);
    assert.deepEqual(privateLeftovers(result.report, IDS), []);
  });
});
