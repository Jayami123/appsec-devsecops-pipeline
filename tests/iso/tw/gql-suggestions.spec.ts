// P5-TW-GQL-006 (tw-iso.md 8.10). Field suggestions. Removed for anonymous callers only under the production
// gate (fork hook removeSuggestionInErrorsRule, probe C5). Actor: anonymous caller (D-TWISO-B14).
// Built: the anonymous negative (title 2). GATED: title 1 (authenticated control) and title 3 (authenticated
// suggestion behaviour): both need a throwaway account, which the single-workspace stack refuses to create.
import { gqlPost } from "../../../src/lanes/tw-iso/gql-client.ts";
import { fieldQuery, shallowQuery } from "../../../src/lanes/tw-iso/fixtures/nested-query.ts";
import { errorMessages } from "../../../src/lanes/tw-iso/verdict.ts";
import { expect, test } from "../../../src/lanes/tw-iso/run-fixture.ts";

test("P5-TW-GQL-006 misspelt field gives no suggestion to an anonymous caller", async () => {
  const control = await gqlPost(null, shallowQuery());
  expect(control.status, "anonymous control must answer 200").toBe(200);
  const reply = await gqlPost(null, fieldQuery("currentUsr")); // typo; no actor
  // The request must reach validation, or the absence of a suggestion proves nothing.
  expect(
    errorMessages(reply.body).length,
    "misspelt query must return a validation error",
  ).toBeGreaterThan(0);
  expect(JSON.stringify(reply.body)).not.toMatch(/Did you mean/);
});
