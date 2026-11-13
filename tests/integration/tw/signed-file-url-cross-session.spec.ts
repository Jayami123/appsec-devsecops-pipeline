// P5-TW-MT-002 (tw-multiws). A signed file URL from one workspace is not readable in another workspace.
// Setup (asserted first): the recipe is on the stack and lvh.me resolves to loopback. Two throwaway owners, each with
// its own workspace. A uploads a PNG and obtains its signed URL (the two-step upload route, as in NEW-TW-4).
// Control: the signed URL read on A's origin: 200 and the PNG bytes.
// Negative: the same path and query, presented to B's origin with B's session (A's file reached from B's workspace).
// Oracle: refused (4xx), and no PNG bytes in the body.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import {
  PNG,
  assertLoopbackRecipeName,
  seededPair,
  readRest,
  recipeRootUrl,
  uploadPng,
} from "./multiws-support.ts";

test("P5-TW-MT-002: a signed file URL from one workspace is not readable in another @multiws", async ({
  run,
}) => {
  const root = recipeRootUrl(); // setup: ENV failure stops here, before any product call
  await assertLoopbackRecipeName(root.hostname);
  const { a, b } = await seededPair({ root, prefix: run.prefix, label: "mt2" });
  const signedUrl = await uploadPng({
    origin: a.origin,
    session: a.session,
    filename: `${run.prefix}-mt002.png`,
  });

  // control: the signed URL on A's origin serves the file
  const control = await fetch(signedUrl);
  expect(control.status, "control: A reads its signed URL").toBe(200);
  expect(Buffer.from(await control.arrayBuffer()).equals(PNG), "control: the PNG bytes").toBe(true);

  // negative: the same path and query on B's origin, with B's session
  const onB = new URL(signedUrl);
  const crossed = new URL(`${onB.pathname}${onB.search}`, b.origin).toString();
  const negative = await readRest({ url: crossed, bearer: b.session.accessToken });
  expect([400, 401, 403, 404], `negative: B is refused (HTTP ${negative.status})`).toContain(
    negative.status,
  );
  expect(negative.text.includes("\u0089PNG"), "negative: no PNG signature in the body").toBe(false);
});
