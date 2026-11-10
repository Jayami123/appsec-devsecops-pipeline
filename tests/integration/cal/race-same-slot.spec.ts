// NEW-CAL-3: two parallel bookings for one slot of one event type. Exactly one is accepted. The
// control is a single booking on a different slot, so the negative never reads a control's state.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  nextBookableStartIso,
} from "../../../src/lanes/cal/actor.ts";
import { createBooking, createEventType } from "../../../src/lanes/cal/booking.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

test.describe("P5-CAL-NEW-CAL-3 same-slot race", () => {
  test("NEW-CAL-3 single booking for a slot succeeds", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const et = await createEventType(api, owner, "p5 slot");
    const single = await createBooking(
      api,
      owner.apiKey,
      et,
      `${prefix}-a1@example.test`,
      nextBookableStartIso(new Date(), 3),
    );
    expect(single.status, "single booking (control)").toBe(201);
  });

  test("NEW-CAL-3 exactly one of two parallel bookings succeeds", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const et = await createEventType(api, owner, "p5 race");
    const start = nextBookableStartIso(new Date(), 4);
    const [a, b] = await Promise.all([
      createBooking(api, owner.apiKey, et, `${prefix}-r1@example.test`, start),
      createBooking(api, owner.apiKey, et, `${prefix}-r2@example.test`, start),
    ]);
    const accepted = [a, b].filter((r) => r.status === 201).length;
    expect(accepted, "exactly one parallel booking succeeds").toBe(1);
  });
});
