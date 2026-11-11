import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFirstLink, mailboxFor } from "../../../../src/lanes/doc/inbucket.ts";

test("extractFirstLink returns the first link whose path matches the prefix", () => {
  const body =
    "Hi\nhttps://example.test/other/x\nthen https://example.test/verify-email/abc123 end";
  assert.equal(
    extractFirstLink(body, "/verify-email/"),
    "https://example.test/verify-email/abc123",
  );
  assert.equal(extractFirstLink("no links here", "/verify-email/"), null);
});

test("mailboxFor names the mailbox by local part and refuses an address outside the run prefix", () => {
  const prefix = "p5-qa-20261110t093000z-1a2b3c4d";
  assert.equal(mailboxFor(`${prefix}-owner-00aa11bb@p5.test`, prefix), `${prefix}-owner-00aa11bb`);
  assert.throws(() => mailboxFor("someone-else@p5.test", prefix), /run-prefixed/);
});
