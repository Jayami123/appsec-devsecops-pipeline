// The Playwright config records commit metadata and never the git diff (D-FND-B30). The diff carries changed lines
// from the repository, so a captured diff would reach every uploaded report.
import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../../../playwright.config.ts";

test("captureGitInfo records the commit and never the diff", () => {
  assert.deepEqual(config.captureGitInfo, { commit: true, diff: false });
});

test("no project overrides git capture", () => {
  for (const project of config.projects ?? []) {
    assert.equal(
      (project as { captureGitInfo?: unknown }).captureGitInfo,
      undefined,
      `${project.name} must not set captureGitInfo`,
    );
  }
});
