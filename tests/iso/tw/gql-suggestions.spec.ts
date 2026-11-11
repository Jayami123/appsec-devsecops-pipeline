// P5-TW-GQL-006 (tw-iso.md 8.10). Field suggestions (D-TWISO-B30). The suggestion rule is removed for anonymous
// callers only under the production gate (hook removeSuggestionInErrorsRule, probe C5). The precondition of each
// negative is the exact validation message, so a pass proves the request reached validation.
import { actorWithCleanup } from "../../../src/lanes/tw-iso/actor-fixture.ts";
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import {
  fieldQuery,
  memberIdQuery,
  shallowQuery,
} from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { errorMessages } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

test("P5-TW-GQL-006 control: correct field returns 200", async ({ run }) => {
  const actor = await actorWithCleanup(run, 41);
  const reply = await gqlPost(actor, memberIdQuery());
  expect(reply.status).toBe(200);
  expect((reply.body as { data?: unknown }).data, "the correct field returns data").toBeDefined();
});

test("P5-TW-GQL-006 misspelt field gives no suggestion to an anonymous caller", async ({ run }) => {
  run.trackLeak({
    label: "anonymous caller: no resource is created",
    stillPresent: () => Promise.resolve(false),
  });
  const control = await gqlPost(null, shallowQuery());
  expect(control.status, "anonymous control must answer 200").toBe(200);
  const reply = await gqlPost(null, fieldQuery("currentUsr"));
  expect(errorMessages(reply.body), "precondition: the validation message").toContain(
    'Cannot query field "currentUsr" on type "Query".',
  );
  expect(JSON.stringify(reply.body)).not.toMatch(/Did you mean/);
});

test("P5-TW-GQL-006 authenticated suggestion behaviour is recorded as a design verdict", async ({
  run,
}) => {
  const actor = await actorWithCleanup(run, 42);
  const reply = await gqlPost(actor, fieldQuery("workspaceMemberz"));
  expect(errorMessages(reply.body), "precondition: the validation message").toContain(
    'Cannot query field "workspaceMemberz" on type "Query".',
  );
  const suggested = errorMessages(reply.body).some((m) => /Did you mean/.test(m));
  test.info().annotations.push({
    type: "verdict",
    description: `design verdict (status ${reply.status}; authenticated suggestion present=${String(suggested)})`,
  });
});
