// P5-TW-GQL-002: held-private (D3). Details are not recorded in the repository (AGENTS.md, master plan 4.7).
// The defect is declared with expectedDefect (src/kit/ci/known-defect.ts), so a fixed product shows as an
// unexpected pass.
import { actorWithCleanup } from "../../../src/lanes/tw-iso/actor-fixture.ts";
import { productDefectState } from "../../../src/lanes/tw-iso/defect-state.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import { overFieldsQuery, shallowQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import {
  parseRateLimitHeaders,
  readEffectiveConfig,
} from "../../../src/lanes/tw-iso/effective-config.ts";
import { classifyReply, describe, errorMessages } from "../../../src/lanes/tw-iso/verdict.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

const CAP_MESSAGE = /too many fields requested/i;
const DEFECT_EVIDENCE = "P5-TW-GQL-002: held-private (D3)";

test("P5-TW-GQL-002 control: cheap query returns 200", async ({ run }) => {
  const actor = await actorWithCleanup(run, 11);
  expect((await gqlPost(actor, shallowQuery())).status).toBe(200);
});

test("P5-TW-GQL-002 query above the effective field cap is refused or recorded as a design verdict", async ({
  run,
}) => {
  const actor = await actorWithCleanup(run, 12);
  expect((await gqlPost(actor, shallowQuery())).status).toBe(200); // control first
  const cap = readEffectiveConfig().GRAPHQL_MAX_FIELDS.value;
  // At cap: no cap refusal, and the actor gets data back.
  const atCap = await gqlPost(actor, overFieldsQuery(cap));
  expect(JSON.stringify(atCap.body), "at the cap no cap refusal").not.toMatch(CAP_MESSAGE);
  expect(atCap.status).toBe(200);
  expect((atCap.body as { data?: unknown }).data, "at the cap the actor gets data").toBeDefined();
  // Cap + 1 with the actor, and the anonymous control: the same document through the hook path.
  const overReply = await gqlPost(actor, overFieldsQuery(cap + 1));
  const authenticatedRefused = classifyReply(overReply, CAP_MESSAGE).verdict === "PASS";
  const anonymousRefused =
    classifyReply(await gqlPost(null, overFieldsQuery(cap + 1)), CAP_MESSAGE).verdict === "PASS";
  const state = productDefectState({ authenticatedRefused, anonymousRefused });
  if (state !== "unconfirmed") {
    // Declared for both "confirmed" and "fixed": a fixed product must show as an unexpected pass, not silently.
    expectedDefect(DEFECT_EVIDENCE);
  }
  const counted = /Too many fields requested: (\d+)/.exec(errorMessages(overReply.body).join(" "));
  if (authenticatedRefused) {
    expect(Number(counted?.[1]), "the counter reports cap + 1").toBe(cap + 1);
    test.info().annotations.push({
      type: "verdict",
      description: `PASS: cap=${cap}; at cap data returned; cap+1 refused, counter=${String(counted?.[1])}; defect state ${state}`,
    });
    return;
  }
  const anonymousVerdict = describe(
    classifyReply(await gqlPost(null, overFieldsQuery(cap + 1)), CAP_MESSAGE),
  );
  const finding =
    state === "confirmed"
      ? `PRODUCT BUG (SUSPECTED): authenticated cap+1 answered (status ${overReply.status}); the same document is refused anonymously (${anonymousVerdict}); held-private (D3)`
      : `design verdict: authenticated cap+1 answered (status ${overReply.status}); anonymous control not refused either (${anonymousVerdict})`;
  test.info().annotations.push({
    type: "verdict",
    description: `cap=${cap}; at cap data returned; ${finding}`,
  });
  expect(finding.startsWith("PRODUCT BUG"), finding).toBe(false);
});

test("P5-TW-GQL-002 records the effective GRAPHQL_MAX_FIELDS read back from the stack", async ({
  run,
}) => {
  const actor = await actorWithCleanup(run, 13);
  const effective = readEffectiveConfig().GRAPHQL_MAX_FIELDS;
  const reply = await gqlPost(actor, shallowQuery());
  const limiter = parseRateLimitHeaders(reply.headers);
  const limiterText =
    limiter.limit === null && limiter.remaining === null && limiter.reset === null
      ? "limiter headers: UNPROBED (no x-ratelimit-* header on an authenticated response)"
      : `limiter limit=${String(limiter.limit)} remaining=${String(limiter.remaining)} reset=${String(limiter.reset)}`;
  test.info().annotations.push({
    type: "readback",
    description: `GRAPHQL_MAX_FIELDS=${String(effective.value)} (${effective.source}); ${limiterText}`,
  });
  expect(reply.status).toBe(200);
});
