// P5-CAL-XSS-001: a script in an event type's description is not executed on the public booker page.
// The event type is created through the v2 API (description field, create DTO); the page is the public
// booker page /<username>/<slug> in Chromium. Control: the plain description text is visible.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  v2,
  V2_EVENT_TYPES_VERSION,
  type CalActor,
} from "../../../src/lanes/cal/actor.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

// Local override only (P5_CHROMIUM_PATH): the pre-installed browser differs from the pinned Playwright build.
// CI installs its own Chromium and leaves the variable unset.
const localChromium = process.env.P5_CHROMIUM_PATH;
test.use(localChromium ? { launchOptions: { executablePath: localChromium } } : {});

const PLAIN = "p5-xss-plain-description";

async function eventTypeWithDescription(
  api: APIRequestContext,
  actor: CalActor,
  description: string,
): Promise<string> {
  const res = await v2(api, actor.apiKey, "POST", "/v2/event-types", V2_EVENT_TYPES_VERSION, {
    title: "p5 xss",
    slug: `p5-xss-${Date.now()}`,
    lengthInMinutes: 30,
    description,
  });
  expect(res.status, "event type with description").toBe(201);
  return (res.body as { data: { slug: string } }).data.slug;
}

test.describe("P5-CAL-XSS-001 event description", () => {
  test("XSS-001 plain description renders", async ({ page, run }) => {
    const prefix = currentRunPrefix();
    const api = await pwRequest.newContext({
      baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, ""),
    });
    run.onCleanup(() => api.dispose());
    const actor = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("xss"));
    run.onCleanup(() => actor.dispose());
    const slug = await eventTypeWithDescription(api, actor, PLAIN);
    await page.goto(`${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}/${actor.username}/${slug}`);
    await expect(page.getByText(PLAIN).first()).toBeVisible();
  });

  test("XSS-001 script in description is not executed", async ({ page, run }) => {
    const prefix = currentRunPrefix();
    const api = await pwRequest.newContext({
      baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, ""),
    });
    run.onCleanup(() => api.dispose());
    const actor = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("xss"));
    run.onCleanup(() => actor.dispose());
    const payload = `${PLAIN} <img src=x onerror="window.__p5xss=1">`;
    const slug = await eventTypeWithDescription(api, actor, payload);
    await page.goto(`${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}/${actor.username}/${slug}`);
    await expect(page.getByText(PLAIN).first()).toBeVisible();
    const flag = await page.evaluate(
      () => (globalThis as unknown as { __p5xss?: unknown }).__p5xss,
    );
    expect(flag, "script in description executed").toBeUndefined();
  });
});
