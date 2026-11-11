import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { parseDefectDescription } from "../../../../src/kit/ci/known-defect.ts";
import {
  type DefectCallArgument,
  findDefectCallArguments,
  listTsFiles,
} from "../../../../src/kit/ci/known-defect-guard.ts";

/** Doc-owned spec files only (D-DOC-B66). A lane test must not police other lanes. */
const DOC_OWNED_SPEC = /^tests\/(?:.*\/)?doc\//;

function isDocOwnedSpec(path: string): boolean {
  return DOC_OWNED_SPEC.test(path);
}

function listDocOwnedSpecs(root: string): string[] {
  return listTsFiles(root, ["tests"]).filter(isDocOwnedSpec);
}

/** A string literal, or a `+` chain of string literals, including parentheses (D-DOC-B67). */
function concatenatedStringLiteral(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return concatenatedStringLiteral(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = concatenatedStringLiteral(node.left);
    const right = concatenatedStringLiteral(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}

/**
 * Every `expectedDefect(<arg>)` call. The argument resolves when it is a string literal, a same-file
 * `const` string literal, or concatenated string literals (`"a" + "b"`). The foundation guard is not
 * edited (H4); this parser is lane-local (D-DOC-B67).
 */
function findLaneDefectCallArguments(path: string, source: string): DefectCallArgument[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS);
  const constants = new Map<string, string>();
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue;
      const value = concatenatedStringLiteral(declaration.initializer);
      if (value !== undefined) constants.set(declaration.name.text, value);
    }
  }
  const out: DefectCallArgument[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "expectedDefect"
    ) {
      const arg = node.arguments[0];
      let value: string | undefined;
      if (arg !== undefined) {
        value = concatenatedStringLiteral(arg);
        if (value === undefined && ts.isIdentifier(arg)) value = constants.get(arg.text);
      }
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      out.push({ path, line, value });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

test("K6-P5 scans only tests/**/doc/**", () => {
  const files = listDocOwnedSpecs(process.cwd());
  assert.ok(files.length > 0, "doc-owned spec files exist");
  for (const file of files) {
    assert.match(file, DOC_OWNED_SPEC, file);
  }
});

test("K6-P5 every expectedDefect call has a resolvable ID and evidence", () => {
  const files = listDocOwnedSpecs(process.cwd());
  const calls = files.flatMap((file) =>
    findLaneDefectCallArguments(file, readFileSync(join(process.cwd(), file), "utf8")),
  );
  assert.ok(calls.length > 0, "the first expectedDefect usage is in this PR");
  for (const call of calls) {
    assert.ok(
      call.value !== undefined && call.value.length > 0,
      `${call.path}:${String(call.line)}: expectedDefect argument is not a resolvable string literal`,
    );
    const parsed = parseDefectDescription(call.value);
    assert.ok(parsed.id.length > 0, `${call.path}:${String(call.line)}: empty defect id`);
    assert.ok(parsed.evidence.length > 0, `${parsed.id} has no evidence`);
  }
});

test("K6-P5 a string-literal argument resolves and a non-literal does not", () => {
  const valid = findDefectCallArguments(
    "valid.ts",
    'const ID = "P5-DOC-X: file.ts:1";\nexpectedDefect(ID);\nexpectedDefect("P5-DOC-Y: file.ts:2");\n',
  );
  assert.equal(valid.length, 2);
  assert.equal(valid[0]?.value, "P5-DOC-X: file.ts:1");
  assert.equal(valid[1]?.value, "P5-DOC-Y: file.ts:2");
  parseDefectDescription("P5-DOC-X: file.ts:1");
  const invalid = findDefectCallArguments(
    "invalid.ts",
    'const id = ["P5-DOC-Z", "file.ts:3"].join(": ");\nexpectedDefect(id);\n',
  );
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0]?.value, undefined);
});

test("K6-P5 concatenated string literals resolve", () => {
  const concat = findLaneDefectCallArguments(
    "concat.ts",
    'expectedDefect("P5-DOC-X: file.ts:" + "1");\nexpectedDefect("P5-DOC-Y: " + ("a" + "b"));\n',
  );
  assert.equal(concat.length, 2);
  assert.equal(concat[0]?.value, "P5-DOC-X: file.ts:1");
  assert.equal(concat[1]?.value, "P5-DOC-Y: ab");
  parseDefectDescription("P5-DOC-X: file.ts:1");
  const invalid = findLaneDefectCallArguments(
    "concat-invalid.ts",
    'expectedDefect("P5-DOC-Z: " + id);\nexpectedDefect(["P5-DOC-Z", "file.ts:3"].join(": "));\n',
  );
  assert.equal(invalid.length, 2);
  assert.equal(invalid[0]?.value, undefined);
  assert.equal(invalid[1]?.value, undefined);
});
