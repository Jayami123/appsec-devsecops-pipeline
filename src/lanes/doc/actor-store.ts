// File-backed throwaway actors for one run (D-DOC-B33). Sign-up happens ONCE per run in a provisioning test
// (never in a worker-scoped fixture), and every later worker, including a worker restarted after a failure,
// reads the stored session instead of signing up again. The sign-up limit is 3 per 3 hours per IP
// (fork ref held by the owner), so the budget is enforced here, before any call.
// Files live under test-results/<run prefix>/actors (test-results/ is gitignored; not an artefact).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { throwawayActor, type ActorLabel, type ThrowawayActor } from "./login.ts";

/** The labels each job provisions. The length is the sign-up budget (doc-api at most 3, doc-serial at most 2). */
export const DOC_API_LABELS: readonly ActorLabel[] = ["owner", "other", "org-b-member"];
export const SERIAL_LABELS: readonly ActorLabel[] = ["owner", "member"];

interface Manifest {
  readonly runPrefix: string;
  /** Sign-up ATTEMPTS made so far (an attempt counts even when it fails, because the limiter counts it). */
  signups: number;
  readonly actors: {
    readonly label: ActorLabel;
    readonly email: string;
    readonly password: string;
    readonly teamId: number;
  }[];
}

export interface ProvisionInput {
  readonly dir: string;
  readonly runPrefix: string;
  readonly labels: readonly ActorLabel[];
  readonly budget: number;
  /** Creates and verifies one account; returns its Playwright storageState and personal team id (D-DOC-B45). */
  readonly signUp: (actor: ThrowawayActor) => Promise<{ storageState: unknown; teamId: number }>;
}

export interface StoredActor {
  readonly label: ActorLabel;
  readonly actor: ThrowawayActor;
  readonly storagePath: string;
  readonly teamId: number;
}

export function actorDir(runPrefix: string, root = "test-results"): string {
  return join(root, runPrefix, "actors");
}

function manifestPath(dir: string): string {
  return join(dir, "manifest.json");
}

function readManifest(dir: string): Manifest | null {
  const path = manifestPath(dir);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Manifest) : null;
}

function writeManifest(dir: string, manifest: Manifest): void {
  writeFileSync(manifestPath(dir), JSON.stringify(manifest, null, 2), { mode: 0o600 });
}

/**
 * Provisions the missing labels and returns the manifest. Labels already stored are NOT signed up again, so a
 * second call (a restarted worker, a rerun inside the same run) makes no sign-up call. The budget is checked
 * before the first sign-up: a run that would exceed it fails closed without calling the product.
 */
export async function provisionActors(input: ProvisionInput): Promise<Manifest> {
  mkdirSync(input.dir, { recursive: true, mode: 0o700 });
  const existing = readManifest(input.dir);
  if (existing !== null && existing.runPrefix !== input.runPrefix) {
    throw new Error("TEST BUG: the actor store belongs to another run");
  }
  const manifest: Manifest = existing ?? { runPrefix: input.runPrefix, signups: 0, actors: [] };
  const have = new Set(manifest.actors.map((a) => a.label));
  const missing = input.labels.filter((label) => !have.has(label));
  if (manifest.signups + missing.length > input.budget) {
    throw new Error(
      `BUDGET: ${manifest.signups} sign-up attempts recorded and ${missing.length} more needed; the budget is ${input.budget} per run`,
    );
  }
  for (const label of missing) {
    const actor = throwawayActor(input.runPrefix, label, randomBytes(4).toString("hex"));
    // Count the attempt BEFORE calling the product, and persist it, so a failed attempt is never forgotten.
    manifest.signups += 1;
    writeManifest(input.dir, manifest);
    const result = await input.signUp(actor);
    writeFileSync(join(input.dir, `${label}.storage.json`), JSON.stringify(result.storageState), {
      mode: 0o600,
    });
    manifest.actors.push({
      label,
      email: actor.email,
      password: actor.password,
      teamId: result.teamId,
    });
    writeManifest(input.dir, manifest);
  }
  return manifest;
}

/** Reads the stored actors of a provisioned run. Throws (ENV) when provisioning did not run. */
export function loadActors(dir: string, runPrefix: string): StoredActor[] {
  const manifest = readManifest(dir);
  if (manifest === null)
    throw new Error("ENV: actors were not provisioned for this run (setup test did not run)");
  if (manifest.runPrefix !== runPrefix)
    throw new Error("TEST BUG: the actor store belongs to another run");
  return manifest.actors.map((record) => ({
    label: record.label,
    actor: { label: record.label, email: record.email, password: record.password },
    storagePath: join(dir, `${record.label}.storage.json`),
    teamId: record.teamId,
  }));
}
