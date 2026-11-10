// Browser settings of the Playwright projects (X plan D-2; AGENTS.md "UI work"). Only the two projects
// that need a browser set one, and both use Chromium.
import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../../../playwright.config.ts";

test("only cal-ui and twenty-closeout set a browser, and both use chromium", () => {
  const withBrowser = (config.projects ?? [])
    .map((project) => [project.name, project.use?.browserName] as const)
    .filter(([, browser]) => browser !== undefined);
  assert.deepEqual(withBrowser, [
    ["cal-ui", "chromium"],
    ["twenty-closeout", "chromium"],
  ]);
});
