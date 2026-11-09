// Vendored from Jayami123/api-webhook-db-test-suite ref 99a2fde tests/unit/invariants/engine.test.ts (relocated to tests/unit/kit/invariants/engine.test.ts, F0-2). Change here only with a reason in the PR.
// F0-2 exclusion (plan 7.2.2): the 'rules:' and 'twenty leak rules' blocks (7 tests) are not carried; they assert the P2 product rule catalog (src/invariants/rules.ts) and lane-kit (src/invariants/lane-kit.ts), which are not vendored.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ReadOnlyDb, SqlParam } from "../../../../src/kit/db/pg.ts";
import { sweepAfterTest } from "../../../../src/kit/invariants/after-test.ts";
import {
  RetainRegistry,
  assertRuleShape,
  formatViolations,
  paramFor,
  runStartIso,
  runSweep,
  type Rule,
} from "../../../../src/kit/invariants/engine.ts";

const PREFIX = "p5-qa-20261101t090000z-0a1b2c3d";

interface Seen {
  sql: string;
  params: readonly SqlParam[];
}
function fakeDb(answer: (sql: string) => Record<string, unknown>[]): {
  db: ReadOnlyDb;
  seen: Seen[];
} {
  const seen: Seen[] = [];
  const db: ReadOnlyDb = {
    product: "db-guard",
    select: <Row extends Record<string, unknown>>(
      sql: string,
      params: readonly SqlParam[] = [],
    ) => {
      seen.push({ sql, params });
      return Promise.resolve(answer(sql) as Row[]);
    },
    close: () => Promise.resolve(),
  };
  return { db, seen };
}

const leak: Rule = {
  id: "t-leak",
  kind: "leak",
  description: "d",
  cite: "c",
  basis: "live",
  verified: "2026-11-01",
  param: "prefix-like",
  sql: String.raw`SELECT "id"::text AS id, "name" AS value FROM "T" WHERE "name" LIKE $1 ESCAPE '\'`,
};
const consistency: Rule = {
  id: "t-cons",
  kind: "consistency",
  description: "d",
  cite: "c",
  basis: "live",
  verified: "2026-11-01",
  param: "run-start",
  sql: `SELECT "id"::text AS id, "s" AS value FROM "T" WHERE "x" IS NULL AND "createdAt" >= $1::timestamptz`,
};

describe("engine: shape checks", () => {
  test("rejects SELECT *, a wrong parameter count, a write, and a leak rule without a prefix", () => {
    assert.throws(() => {
      assertRuleShape({ ...consistency, sql: "SELECT * FROM t WHERE a < $1" });
    }, /selects \*/);
    assert.throws(() => {
      assertRuleShape({ ...consistency, sql: `SELECT "id" AS id, 'x' AS value FROM "T"` });
    }, /0 parameters, expected 1/);
    assert.throws(() => {
      assertRuleShape({ ...consistency, sql: `DELETE FROM "T" WHERE "createdAt" >= $1` });
    }, /read-only guard/);
    assert.throws(() => {
      assertRuleShape({ ...leak, param: "run-start" });
    }, /needs a run-prefix parameter/);
    assert.throws(() => {
      assertRuleShape({ ...consistency, kind: "orphan", param: "prefix-like" });
    }, /must be scoped with the run-start/);
    assert.throws(() => {
      assertRuleShape({ ...consistency, perSchemaQuery: "SELECT 1" });
    }, /\{schema\}/);
  });

  test("runStartIso reads the UTC start out of the prefix and refuses anything else", () => {
    assert.equal(runStartIso(PREFIX), "2026-11-01T09:00:00.000Z");
    assert.throws(() => runStartIso("p5-qa-oops"), /not a run prefix/);
  });

  test("paramFor escapes LIKE wildcards and builds prefix and contains patterns", () => {
    assert.deepEqual(paramFor(leak, PREFIX), [`${PREFIX}%`]);
    assert.deepEqual(paramFor({ ...leak, param: "contains-like" }, PREFIX), [`%${PREFIX}%`]);
    assert.deepEqual(paramFor(consistency, PREFIX), ["2026-11-01T09:00:00.000Z"]);
    assert.deepEqual(paramFor({ ...leak, param: undefined } as unknown as Rule, PREFIX), []);
  });
});

describe("engine: sweep", () => {
  test("a clean database yields no violations and sends the right parameters", async () => {
    const { db, seen } = fakeDb(() => []);
    const out = await runSweep(db, [leak, consistency], { runPrefix: PREFIX, includeLeaks: true });
    assert.deepEqual(out, []);
    assert.deepEqual(
      seen.map((s) => s.params),
      [[`${PREFIX}%`], ["2026-11-01T09:00:00.000Z"]],
    );
  });

  test("violations carry the rule, the SQL, the parameters and string rows", async () => {
    const { db } = fakeDb(() => [{ id: 7, value: "p5-qa-x" }]);
    const [v] = await runSweep(db, [leak], { runPrefix: PREFIX, includeLeaks: true });
    assert.ok(v);
    assert.deepEqual(
      [v.ruleId, v.kind, v.rows],
      ["t-leak", "leak", [{ id: "7", value: "p5-qa-x" }]],
    );
    assert.equal(v.sql, leak.sql);
    assert.deepEqual(v.params, [`${PREFIX}%`]);
  });

  test("includeLeaks=false skips leak rules but still runs the others", async () => {
    const { db, seen } = fakeDb(() => []);
    await runSweep(db, [leak, consistency], { runPrefix: PREFIX, includeLeaks: false });
    assert.equal(seen.length, 1);
    assert.match(seen[0]?.sql ?? "", /"x" IS NULL/);
  });

  test("retained values are ignored for leak rules only, by exact rule id and value", async () => {
    const retained = new RetainRegistry();
    const release = retained.retain("t-leak", "p5-qa-kept");
    const rows = [
      { id: "1", value: "p5-qa-kept" },
      { id: "2", value: "p5-qa-leaked" },
    ];
    const { db } = fakeDb(() => rows);
    const [v] = await runSweep(db, [leak], { runPrefix: PREFIX, includeLeaks: true, retained });
    assert.deepEqual(
      v?.rows.map((r) => r.value),
      ["p5-qa-leaked"],
    );
    release();
    const again = await runSweep(db, [leak], { runPrefix: PREFIX, includeLeaks: true, retained });
    assert.equal(again[0]?.rows.length, 2);
    const kept = new RetainRegistry();
    kept.retain("t-cons", "p5-qa-kept");
    const cons = await runSweep(fakeDb(() => rows).db, [consistency], {
      runPrefix: PREFIX,
      includeLeaks: true,
      retained: kept,
    });
    assert.equal(cons[0]?.rows.length, 2, "consistency violations are never excused");
  });

  test("a per-schema rule runs once per schema the catalog returns and quotes the name", async () => {
    const perSchema: Rule = {
      ...leak,
      id: "t-schema",
      perSchemaQuery: "SELECT schema_name FROM information_schema.schemata",
      sql: leak.sql.replace('"T"', '{schema}."person"'),
    };
    const { db, seen } = fakeDb((sql) =>
      sql.includes("schemata")
        ? [{ schema_name: "workspace_a1" }, { schema_name: "workspace_b2" }]
        : [{ id: "1", value: "x" }],
    );
    const out = await runSweep(db, [perSchema], { runPrefix: PREFIX, includeLeaks: true });
    assert.deepEqual(
      out.map((v) => v.schema),
      ["workspace_a1", "workspace_b2"],
    );
    assert.ok(seen.some((s) => s.sql.includes('"workspace_a1"."person"')));
  });

  test("a schema name that is not a plain identifier stops the sweep", async () => {
    const perSchema: Rule = {
      ...leak,
      perSchemaQuery: "SELECT 1",
      sql: leak.sql.replace('"T"', "{schema}.t"),
    };
    const { db } = fakeDb((sql) => (sql === "SELECT 1" ? [{ schema_name: 'x"; drop' }] : []));
    await assert.rejects(
      runSweep(db, [perSchema], { runPrefix: PREFIX, includeLeaks: true }),
      /unexpected schema name/,
    );
  });
});

describe("engine: report", () => {
  test("formatViolations prints rule, source, SQL, parameters and rows, clips long values and caps rows", () => {
    const text = formatViolations([
      {
        ruleId: "t-leak",
        kind: "leak",
        description: "No leak",
        cite: "schema.prisma:1",
        sql: "SELECT 1",
        params: ["a%"],
        schema: undefined,
        rows: Array.from({ length: 25 }, (_, i) => ({ id: String(i), value: "v".repeat(200) })),
      },
    ]);
    assert.match(
      text,
      /^t-leak \[leak\] No leak\n {2}relies on: schema\.prisma:1\n {2}sql: SELECT 1\n {2}params: \["a%"\]/,
    );
    assert.equal((text.match(/ {2}id=/g) ?? []).length, 20);
    assert.match(text, / {2}\.\.\. 5 more/);
    assert.ok(!text.includes("v".repeat(121)));
  });

  test("rows of a rule whose id names a secret are redacted", () => {
    const text = formatViolations([
      {
        ruleId: "x-token-leak",
        kind: "leak",
        description: "d",
        cite: "c",
        sql: "s",
        params: [],
        schema: "ws_1",
        rows: [{ id: "1", value: "tok_123" }],
      },
    ]);
    assert.ok(!text.includes("tok_123"));
    assert.match(text, /\[leak ws_1\]/);
  });

  test("sweepAfterTest returns nothing when clean and a report when not", async () => {
    const clean = await sweepAfterTest({
      db: fakeDb(() => []).db,
      rules: [leak],
      runPrefix: PREFIX,
      retained: new RetainRegistry(),
    });
    assert.equal(clean, undefined);
    const dirty = await sweepAfterTest({
      db: fakeDb(() => [{ id: "1", value: "p5-qa-left" }]).db,
      rules: [leak],
      runPrefix: PREFIX,
      retained: new RetainRegistry(),
    });
    assert.ok(dirty);
    assert.equal(dirty.violations.length, 1);
    assert.match(dirty.report, /t-leak/);
  });
});
