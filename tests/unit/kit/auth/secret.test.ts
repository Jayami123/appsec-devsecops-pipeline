// Vendored from Jayami123/api-webhook-db-test-suite ref 99a2fde tests/unit/auth/secret.test.ts (relocated to tests/unit/kit/auth/secret.test.ts, F0-2). Change here only with a reason in the PR.
// F0-2 exclusion (plan 7.2.2): the 'revokeAndVerify' block (3 tests) is not carried; it needs src/kit/auth/lifecycle.ts and src/kit/auth/http.ts, which are not in the vendored closure.
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { afterEach, describe, test } from "node:test";
import {
  addSecret,
  clearSecretsForTests,
  scrubSecrets,
  SecretString,
} from "../../../../src/kit/auth/secret.ts";

afterEach(() => {
  clearSecretsForTests();
});

describe("SecretString", () => {
  const value = "tok_abcdef0123456789";

  test("never prints its value through String, template strings, JSON or inspect", () => {
    const secret = new SecretString(value);
    const printed = [
      String(secret),
      secret.toString(),
      JSON.stringify({ secret }),
      inspect(secret),
      inspect({ nested: { secret } }),
      JSON.stringify([secret]),
    ];
    for (const text of printed) assert.ok(!text.includes(value), text);
    assert.equal(String(secret), "<redacted:20>");
  });

  test("never prints through console.log", () => {
    const secret = new SecretString(value);
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === "string" ? a : inspect(a))).join(" "));
    };
    try {
      console.log(secret, { secret }, [secret]);
    } finally {
      console.log = original;
    }
    assert.ok(!lines.join("\n").includes(value));
  });

  test("reveal() returns the value for the HTTP layer and length is exposed", () => {
    const secret = new SecretString(value);
    assert.equal(secret.reveal(), value);
    assert.equal(secret.length, value.length);
  });

  test("an empty secret is refused", () => {
    assert.throws(() => new SecretString(""), /must not be empty/);
  });

  test("scrubSecrets replaces every wrapped or added secret and ignores short strings", () => {
    const secret = new SecretString(value);
    addSecret("hunter2-hunter2");
    addSecret("abc");
    const text = `a ${secret.reveal()} b hunter2-hunter2 c abc ${secret.reveal()}`;
    assert.equal(scrubSecrets(text), "a <redacted> b <redacted> c abc <redacted>");
  });
});
