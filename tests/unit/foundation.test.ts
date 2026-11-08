// Foundation configuration pins for the P5 skeleton. These check repository configuration only;
// they exercise no product, no environment variable and no harness code.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoPath = (relative: string): string =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));

test("package.json pins qa-portfolio-harness to v0.3.1", () => {
  const pkg = JSON.parse(readFileSync(repoPath("package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  assert.equal(
    pkg.dependencies?.["qa-portfolio-harness"],
    "github:Jayami123/qa-portfolio-harness#v0.3.1",
  );
});

test("scripts/bootstrap.sh pins the four product refs to the P2 values", () => {
  const expected: Record<string, string> = {
    MEDUSA_REF: "f677db438f27294fc50e4c7c6612e71ff38eeff5",
    DOCUMENSO_REF: "f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c",
    TWENTY_REF: "7cbdfec6f346b43715bc2056932f4fad5886f733",
    CAL_REF: "c2b7ac44c66f24ffef1662b276f0653988a609a3",
  };
  const script = readFileSync(repoPath("scripts/bootstrap.sh"), "utf8");

  // Only top-level, unindented assignments count: a comment or an indented line cannot satisfy them.
  const assignments = new Map<string, string[]>();
  for (const match of script.matchAll(/^([A-Z_]+_REF)="([^"]*)"$/gm)) {
    const name = match[1] ?? "";
    const value = match[2] ?? "";
    assignments.set(name, [...(assignments.get(name) ?? []), value]);
  }

  for (const [name, sha] of Object.entries(expected)) {
    assert.deepEqual(assignments.get(name), [sha], `${name} must be assigned exactly once`);
  }
});
