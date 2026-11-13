// Pure checks for the multi-workspace helpers (no network, no DNS): the README recipe gate and the origin builder.
import assert from "node:assert/strict";
import { test } from "node:test";
import { recipeRootUrl, workspaceOrigin } from "../../../integration/tw/multiws-support.ts";

const RECIPE = {
  TWENTY_BASE_URL: "http://lvh.me:3002",
  IS_MULTIWORKSPACE_ENABLED: "true",
  IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS: "false",
};

test("recipeRootUrl accepts exactly the README recipe", () => {
  assert.equal(recipeRootUrl(RECIPE).host, "lvh.me:3002");
});

test("recipeRootUrl fails closed without each flag, naming the variable and not the value", () => {
  for (const name of [
    "IS_MULTIWORKSPACE_ENABLED",
    "IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS",
  ]) {
    const env = Object.fromEntries(Object.entries(RECIPE).filter(([key]) => key !== name));
    assert.throws(() => recipeRootUrl(env), new RegExp(`ENV: ${name} is not`));
  }
  assert.throws(
    () => recipeRootUrl({ ...RECIPE, IS_MULTIWORKSPACE_ENABLED: " true" }),
    /ENV: IS_MULTIWORKSPACE_ENABLED/,
  );
});

test("recipeRootUrl rejects a missing base URL, https, localhost and an IP", () => {
  assert.throws(
    () => recipeRootUrl({ ...RECIPE, TWENTY_BASE_URL: "" }),
    /TWENTY_BASE_URL is not set/,
  );
  assert.throws(
    () => recipeRootUrl({ ...RECIPE, TWENTY_BASE_URL: "https://lvh.me:3002" }),
    /must be http/,
  );
  assert.throws(
    () => recipeRootUrl({ ...RECIPE, TWENTY_BASE_URL: "http://localhost:3002" }),
    /wildcard name/,
  );
  assert.throws(
    () => recipeRootUrl({ ...RECIPE, TWENTY_BASE_URL: "http://127.0.0.1:3002" }),
    /wildcard name/,
  );
});

test("workspaceOrigin puts the subdomain on the recipe host with its port", () => {
  assert.equal(workspaceOrigin("apple", new URL("http://lvh.me:3002")), "http://apple.lvh.me:3002");
  assert.equal(workspaceOrigin("yc", new URL("http://lvh.me:3002")), "http://yc.lvh.me:3002");
});

test("workspaceOrigin refuses a value that is not a DNS label", () => {
  assert.throws(() => workspaceOrigin("a.b", new URL("http://lvh.me:3002")), /not a DNS label/);
  assert.throws(() => workspaceOrigin("", new URL("http://lvh.me:3002")), /not a DNS label/);
});
