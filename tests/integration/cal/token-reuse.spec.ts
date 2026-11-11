// NEW-CAL-2: a booking uid used for a cancel a second time is refused and the state does not change.
// First use: POST /v2/bookings/:uid/cancel (bookings.controller.ts:336). Second use: same request.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  labelFor,
  createThrowawayActor,
  nextBookableStartIso,
} from "../../../src/lanes/cal/actor.ts";
import {
  bookingStatusOf,
  cancelBooking,
  createBooking,
  createEventType,
  getBooking,
} from "../../../src/lanes/cal/booking.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

test.describe("P5-CAL-NEW-CAL-2 token reuse", () => {
  test("NEW-CAL-2 first use succeeds", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const et = await createEventType(api, owner, "p5 reuse");
    const b = await createBooking(
      api,
      owner.apiKey,
      et,
      `${prefix}-attendee@example.test`,
      nextBookableStartIso(new Date()),
    );
    expect(b.status).toBe(201);
    const first = await cancelBooking(api, owner.apiKey, b.uid);
    expect(first.status, "first cancel").toBeLessThan(300);
    const after = await getBooking(api, owner.apiKey, b.uid);
    expect(bookingStatusOf(after.body), "state after first use").toBe("cancelled");
  });

  test("NEW-CAL-2 second use is refused", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const et = await createEventType(api, owner, "p5 reuse");
    const b = await createBooking(
      api,
      owner.apiKey,
      et,
      `${prefix}-attendee@example.test`,
      nextBookableStartIso(new Date()),
    );
    expect(b.status).toBe(201);
    const first = await cancelBooking(api, owner.apiKey, b.uid);
    expect(first.status, "first cancel (control)").toBeLessThan(300);
    const second = await cancelBooking(api, owner.apiKey, b.uid);
    expect(second.status, "second use refused").toBeGreaterThanOrEqual(400);
    const after = await getBooking(api, owner.apiKey, b.uid);
    expect(bookingStatusOf(after.body), "state unchanged by the refusal").toBe("cancelled");
  });
});
