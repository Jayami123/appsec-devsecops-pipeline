// RED-001 and NEW-CAL-5: the successRedirectUrl of an event type (v2 create DTO, line 504). An internal
// URL is accepted (control). External, scheme and protocol-relative and encoded external variants are
// refused. A warned accept is a design verdict, not a pass. Requests go through the v2 API.
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

async function createWithRedirect(api: APIRequestContext, actor: CalActor, url: string) {
  return v2(api, actor.apiKey, "POST", "/v2/event-types", V2_EVENT_TYPES_VERSION, {
    title: "p5 redirect",
    slug: `p5-red-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    lengthInMinutes: 30,
    successRedirectUrl: url,
  });
}

async function setup(run: { onCleanup(step: () => Promise<unknown>): void }, label: string) {
  const prefix = currentRunPrefix();
  const api = await pwRequest.newContext({
    baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, ""),
  });
  run.onCleanup(() => api.dispose());
  const actor = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor(label));
  run.onCleanup(() => actor.dispose());
  return { api, actor };
}

const INTERNAL = `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}/p5-internal-success`;

test.describe("P5-CAL-RED-001 success redirect", () => {
  test("RED-001 internal successRedirectUrl is accepted", async ({ run }) => {
    const { api, actor } = await setup(run, "red");
    const res = await createWithRedirect(api, actor, INTERNAL);
    expect(res.status, "internal successRedirectUrl accepted").toBe(201);
  });

  test("RED-001 external successRedirectUrl is owner-configured, not booker input (design verdict)", async ({
    run,
  }) => {
    // The target comes from the event type (fork ref held by the owner);
    // only an authenticated owner can write it (fork ref held by the owner).
    // Booker query parameters are forwarded, not used as the target (fork ref held by the owner).
    test.info().annotations.push({
      type: "design-verdict",
      description:
        "owner-configured external redirect: the organiser sets the target; the booker cannot (fork ref held by the owner; fork ref held by the owner)",
    });
    const { api, actor } = await setup(run, "red");
    const owner = await createWithRedirect(api, actor, "https://example.org/p5-external");
    expect(owner.status, "owner sets an external successRedirectUrl (design)").toBe(201);
    const anonymous = await v2(api, null, "POST", "/v2/event-types", V2_EVENT_TYPES_VERSION, {
      title: "p5 anon redirect",
      slug: `p5-anon-red-${Date.now()}`,
      lengthInMinutes: 30,
      successRedirectUrl: "https://example.org/p5-anon",
    });
    expect(
      [401, 403],
      `anonymous event type with an external redirect, status ${anonymous.status}`,
    ).toContain(anonymous.status);
  });
});

test.describe("P5-CAL-NEW-CAL-5 success redirect variants", () => {
  test("NEW-CAL-5 internal URL is accepted", async ({ run }) => {
    const { api, actor } = await setup(run, "n5");
    const res = await createWithRedirect(api, actor, INTERNAL);
    expect(res.status, "internal URL accepted").toBe(201);
  });

  test("NEW-CAL-5 scheme and protocol-relative variants are refused", async ({ run }) => {
    const { api, actor } = await setup(run, "n5");
    const js = await createWithRedirect(api, actor, "javascript:alert(1)");
    const rel = await createWithRedirect(api, actor, "//evil.example.org/p5");
    expect(js.status, `javascript: scheme, status ${js.status}`).toBeGreaterThanOrEqual(400);
    expect(rel.status, `protocol-relative, status ${rel.status}`).toBeGreaterThanOrEqual(400);
  });

  test("NEW-CAL-5 encoded external variant is refused", async ({ run }) => {
    const { api, actor } = await setup(run, "n5");
    const enc = await createWithRedirect(api, actor, "/%2F%2Fevil.example.org/p5");
    expect(enc.status, `encoded external variant, status ${enc.status}`).toBeGreaterThanOrEqual(
      400,
    );
  });
});
