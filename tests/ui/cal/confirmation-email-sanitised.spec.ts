// P5-CAL-XSS-002: an attendee name carrying markup must not reach the confirmation mail as raw markup.
// The booking is created through API v2 (fork ref held by the owner bookings, 2024-08-13); the attendee address is a
// non-user address under the run prefix, and the confirmation is read from the Cal mail catcher
// (harness calMailApiUrl). Control: a plain attendee name appears in the mail. Negative: the markup
// payload is absent from the HTML body as raw markup.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  nextBookableStartIso,
  v2,
  V2_EVENT_TYPES_VERSION,
  type CalActor,
} from "../../../src/lanes/cal/actor.ts";
import { catcherMessagesStartingWith, type CatcherMessage } from "../../../src/lanes/cal/mail.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

const PLAIN_NAME = "p5-xss2-plain-name";
const PAYLOAD_NAME = `p5-xss2 <img src=x onerror="window.__p5xss=1">`;
const RAW_PAYLOAD = `<img src=x onerror="window.__p5xss=1">`;
const MAIL_DEADLINE_MS = 30_000;

function apiBase(): string {
  return loadEnv().CAL_API_BASE_URL.replace(/\/$/, "");
}

/**
 * Event type with an in-person location, created through API v2 (2024-06-14). The default Daily video
 * location needs an integration this stack does not seed, so the meeting fails and no attendee mail is
 * sent (build log). An in-person location needs no integration.
 */
async function inPersonEventType(
  api: APIRequestContext,
  actor: CalActor,
  title: string,
): Promise<number> {
  const res = await v2(api, actor.apiKey, "POST", "/v2/event-types", V2_EVENT_TYPES_VERSION, {
    title,
    slug: `${actor.userPrefix}-${actor.label}-${Date.now()}`,
    lengthInMinutes: 30,
    locations: [{ type: "address", address: "p5 xss2 room", public: true }],
  });
  if (res.status !== 201)
    throw new Error(
      `EVENT_TYPE_FAILED status ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`,
    );
  return (res.body as { data: { id: number } }).data.id;
}

/**
 * Books one slot through the web booker route (/api/book/event, fork ref held by the owner The web
 * process has the SMTP settings the harness wrote, so its confirmation reaches the catcher; the API v2
 * process has none (see the build log). Anonymous, as a booker is. Returns the HTTP status.
 */
async function bookWithName(
  web: APIRequestContext,
  eventTypeId: number,
  attendeeEmail: string,
  name: string,
): Promise<number> {
  const res = await web.post(`${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}/api/book/event`, {
    headers: { "content-type": "application/json" },
    data: {
      eventTypeId,
      start: nextBookableStartIso(new Date(), 5),
      timeZone: "UTC",
      language: "en",
      metadata: {},
      responses: { name, email: attendeeEmail, location: { value: "address", optionValue: "" } },
    },
  });
  return res.status();
}

/** Polls the catcher until the attendee copy (subject starts with the unique event title) exists. */
async function confirmationFor(title: string): Promise<CatcherMessage[]> {
  let found: CatcherMessage[] = [];
  await expect
    .poll(
      async () => {
        found = await catcherMessagesStartingWith(title);
        return found.length > 0;
      },
      { message: "confirmation mail reaches the catcher", timeout: MAIL_DEADLINE_MS },
    )
    .toBe(true);
  return found;
}

test.describe("P5-CAL-XSS-002 confirmation mail", () => {
  test("XSS-002 plain text in the confirmation body", async ({ run }) => {
    const api = await pwRequest.newContext({ baseURL: apiBase() });
    run.onCleanup(() => api.dispose());
    const actor = await createThrowawayActor(
      loadEnv().CAL_BASE_URL,
      currentRunPrefix(),
      labelFor("xss2"),
    );
    run.onCleanup(() => actor.dispose());
    const title = `p5 xss2 plain ${Date.now()}`;
    const eventTypeId = await inPersonEventType(api, actor, title);
    const attendee = `${currentRunPrefix()}-att-plain@example.test`;
    const web = await pwRequest.newContext({ baseURL: loadEnv().CAL_BASE_URL });
    run.onCleanup(() => web.dispose());
    expect(
      await bookWithName(web, eventTypeId, attendee, PLAIN_NAME),
      "control booking created",
    ).toBe(200);
    const mails = await confirmationFor(title);
    expect(
      mails.some((m) => m.html.includes(PLAIN_NAME)),
      "plain name appears in the confirmation HTML",
    ).toBe(true);
  });

  test("XSS-002 script or markup in confirmation body is sanitised", async ({ run }) => {
    const api = await pwRequest.newContext({ baseURL: apiBase() });
    run.onCleanup(() => api.dispose());
    const actor = await createThrowawayActor(
      loadEnv().CAL_BASE_URL,
      currentRunPrefix(),
      labelFor("xss2"),
    );
    run.onCleanup(() => actor.dispose());
    const title = `p5 xss2 markup ${Date.now()}`;
    const eventTypeId = await inPersonEventType(api, actor, title);
    const attendee = `${currentRunPrefix()}-att-markup@example.test`;
    const web = await pwRequest.newContext({ baseURL: loadEnv().CAL_BASE_URL });
    run.onCleanup(() => web.dispose());
    expect(
      await bookWithName(web, eventTypeId, attendee, PAYLOAD_NAME),
      "booking with markup name created",
    ).toBe(200);
    const mails = await confirmationFor(title);
    expect(mails.length, "confirmation mail present").toBeGreaterThan(0);
    expect(
      mails.some((m) => m.html.includes("p5-xss2 &lt;img")),
      "the name is present in the HTML, escaped (valid control for the negative)",
    ).toBe(true);
    expect(
      mails.some((m) => m.html.includes(RAW_PAYLOAD)),
      "markup payload is not raw in the confirmation HTML",
    ).toBe(false);
  });
});
