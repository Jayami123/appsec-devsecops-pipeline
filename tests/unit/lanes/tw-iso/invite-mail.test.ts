import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteTokenFromText, mailSearchQuery } from "../../../../src/lanes/tw-iso/invite-mail.ts";

// Fixed fake token only (never a real invite token).
const FAKE = "fake-token-0123";

test("inviteTokenFromText returns the token from an invitation link and refuses a link with no token", () => {
  const link = `https://example.test/invite/hash?inviteToken=${FAKE}&email=a%40example.test`;
  assert.equal(inviteTokenFromText(link), FAKE);
  assert.equal(
    inviteTokenFromText("https://example.test/invite/hash?email=a%40example.test"),
    undefined,
  );
  assert.equal(inviteTokenFromText("no link here"), undefined);
});

test("inviteTokenFromText never returns a value from a malformed percent-escape", () => {
  assert.equal(inviteTokenFromText("?inviteToken=%E0%A4%A"), undefined);
});

test("mailSearchQuery refuses an address that is not plain", () => {
  assert.equal(mailSearchQuery("p5-qa-x-iso-1@example.test"), "to:p5-qa-x-iso-1@example.test");
  assert.throws(() => mailSearchQuery("not an address"), /TEST BUG/);
});
