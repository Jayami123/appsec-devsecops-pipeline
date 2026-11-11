// Creates one throwaway member for a spec and registers its cleanup and leak probe in the run fixture
// (tw-iso.md 8.0 rule 7). The cleanup evidence goes into the test annotations (booleans and counts only).
import { createThrowawayActor, type ThrowawayActor } from "./twenty-login.ts";
import { test, type RunScope } from "./run-fixture.ts";

export async function actorWithCleanup(run: RunScope, index: number): Promise<ThrowawayActor> {
  const actor = await createThrowawayActor({ mintApiKey: true, index });
  run.onCleanup(async () => {
    const evidence = await actor.cleanup();
    test.info().annotations.push({ type: "cleanup", description: JSON.stringify(evidence) });
  });
  run.trackLeak({
    label: `throwaway member, index ${index}`,
    stillPresent: () => actor.isAuthenticated(),
  });
  return actor;
}
