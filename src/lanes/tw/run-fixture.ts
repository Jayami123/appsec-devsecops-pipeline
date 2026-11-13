// Lane run fixture: cleanup steps (reverse order, all run, first error rethrown) and an API-level
// leak check. The DB sweep fork ref held by the owner) needs qa_ro, which is not wired
// fork ref held by the owner); it is deferred to a foundation PR.
import { test as base, expect } from "@playwright/test";
import { currentRunPrefix } from "../../kit/run/prefix.ts";
import { runAllThenRethrow, type CleanupStep } from "../../kit/shared/cleanup.ts";

/** Returns true while the resource it watches still exists (read through a product route). */
export interface LeakProbe {
  /** Non-secret label, e.g. "api key <id>". Never a token, cookie or password. */
  readonly label: string;
  readonly stillPresent: () => Promise<boolean>;
}

export interface RunScope {
  /** The run prefix fork ref held by the owner). Every created name starts with it. */
  readonly prefix: string;
  /** Register a cleanup right after creating a resource. Steps run in reverse order. */
  onCleanup(step: CleanupStep): void;
  /** Register a probe that must report "gone" after cleanup. */
  trackLeak(probe: LeakProbe): void;
}

/** Labels of the probes whose resource is still present, in registration order. */
export async function findLeaks(probes: readonly LeakProbe[]): Promise<string[]> {
  const leaked: string[] = [];
  for (const probe of probes) {
    if (await probe.stillPresent()) leaked.push(probe.label);
  }
  return leaked;
}

export const test = base.extend<{ run: RunScope }>({
  // eslint-disable-next-line no-empty-pattern
  run: async ({}, use, testInfo) => {
    const steps: CleanupStep[] = [];
    const probes: LeakProbe[] = [];
    await use({
      prefix: currentRunPrefix(),
      onCleanup: (step) => {
        steps.push(step);
      },
      trackLeak: (probe) => {
        probes.push(probe);
      },
    });
    await runAllThenRethrow([...steps].reverse());
    const leaked = await findLeaks(probes);
    testInfo.annotations.push({
      type: "leak-check",
      description: leaked.length === 0 ? "clean" : `leaked: ${leaked.join(", ")}`,
    });
    expect(leaked, "API-level leak check after cleanup").toEqual([]);
  },
});

export { expect };
