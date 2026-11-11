import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadActors, provisionActors } from "../../../../src/lanes/doc/actor-store.ts";

const PREFIX = "p5-qa-20261111t060000z-1a2b3c4d";
const LABELS = ["owner", "other"] as const;

function freshDir(): string {
  return join(mkdtempSync(join(tmpdir(), "p5-actors-")), "actors");
}

test("provisionActors signs up each label once and records every attempt", async () => {
  const dir = freshDir();
  let calls = 0;
  try {
    const manifest = await provisionActors({
      dir,
      runPrefix: PREFIX,
      labels: LABELS,
      budget: LABELS.length,
      signUp: () => {
        calls += 1;
        return Promise.resolve({ cookies: [], origins: [] });
      },
    });
    assert.equal(calls, LABELS.length);
    assert.equal(manifest.signups, LABELS.length);
    assert.equal(loadActors(dir, PREFIX).length, LABELS.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a worker restart does not trigger a sign-up", async () => {
  const dir = freshDir();
  let calls = 0;
  const signUp = () => {
    calls += 1;
    return Promise.resolve({ cookies: [], origins: [] });
  };
  try {
    await provisionActors({
      dir,
      runPrefix: PREFIX,
      labels: LABELS,
      budget: LABELS.length,
      signUp,
    });
    // A restarted worker re-runs everything that is not a test: it only reads the stored actors.
    const restarted = loadActors(dir, PREFIX);
    assert.equal(restarted.length, LABELS.length);
    // A second provisioning in the same run (a rerun, a later project) makes no sign-up call either.
    await provisionActors({
      dir,
      runPrefix: PREFIX,
      labels: LABELS,
      budget: LABELS.length,
      signUp,
    });
    assert.equal(calls, LABELS.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("provisionActors refuses to exceed the sign-up budget before any sign-up", async () => {
  const dir = freshDir();
  let calls = 0;
  try {
    await assert.rejects(
      provisionActors({
        dir,
        runPrefix: PREFIX,
        labels: ["owner", "other", "member"],
        budget: LABELS.length,
        signUp: () => {
          calls += 1;
          return Promise.resolve({});
        },
      }),
      /BUDGET/,
    );
    assert.equal(calls, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
