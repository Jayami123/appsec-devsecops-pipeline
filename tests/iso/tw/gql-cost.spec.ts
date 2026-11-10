// P5-TW-GQL-002 (tw-iso.md 8.6). Requested field count around the effective cap (D-TWISO-B29).
// Real fields only (overFieldsQuery). The refusal message reports the requested count, so the boundary checks
// the counter itself. The cap comes from the readback (no named budget; tw-iso.md section 13 item 11).
// Finding (live, D-TWISO-B33): an authenticated workspace query above the cap is answered, not refused, because
// the direct-execution route answers before the complexity hook (use-direct-execution.hook.ts onRequest) and
// checks only root resolvers (direct-execution.service.ts:518-528). The anonymous control below sends the same
// document through the hook path and gets the cap refusal.
import { actorWithCleanup } from "../../../src/lanes/tw-iso/actor-fixture.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import { overFieldsQuery, shallowQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import {
  parseRateLimitHeaders,
  readEffectiveConfig,
} from "../../../src/lanes/tw-iso/effective-config.ts";
import { classifyReply, describe, errorMessages } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

const CAP_MESSAGE = /too many fields requested/i;

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
  // Cap + 1 with the actor: refused by the cap, and the refusal names the requested count.
  const overReply = await gqlPost(actor, overFieldsQuery(cap + 1));
  const overCap = classifyReply(overReply, CAP_MESSAGE);
  const counted = /Too many fields requested: (\d+)/.exec(errorMessages(overReply.body).join(" "));
  if (overCap.verdict === "PASS") {
    expect(Number(counted?.[1]), "the counter reports cap + 1").toBe(cap + 1);
    test.info().annotations.push({
      type: "verdict",
      description: `PASS: cap=${cap}; at cap data returned; cap+1 refused, counter=${String(counted?.[1])}`,
    });
    return;
  }
  // Not refused with the actor. Control: the same document, anonymous, goes through the hook path.
  const anonymous = classifyReply(await gqlPost(null, overFieldsQuery(cap + 1)), CAP_MESSAGE);
  const finding =
    anonymous.verdict === "PASS"
      ? `PRODUCT BUG (SUSPECTED): authenticated cap+1 answered (status ${overReply.status}); the same document is refused anonymously by the same cap (${describe(anonymous)}); direct-execution.service.ts:518-528 checks root resolvers only`
      : `design verdict: authenticated cap+1 answered (status ${overReply.status}); anonymous control not refused either (${describe(anonymous)})`;
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
