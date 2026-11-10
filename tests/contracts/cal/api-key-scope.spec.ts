// NEW-CAL-4: an API key reads its own user's booking (control) and is refused on another user's
// booking, which stays unchanged. Routes: bookings.controller.ts:190 (GET /v2/bookings/:uid).
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  nextBookableStartIso,
} from "../../../src/lanes/cal/actor.ts";
import {
  bookingStatusOf,
  createBooking,
  createEventType,
  getBooking,
} from "../../../src/lanes/cal/booking.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

test.describe("P5-CAL-NEW-CAL-4 api key scope", () => {
  test("NEW-CAL-4 key A reads A's resource", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const a = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("keya"));
    run.onCleanup(() => a.dispose());
    const et = await createEventType(api, a, "p5 scope");
    const b = await createBooking(
      api,
      a.apiKey,
      et,
      `${prefix}-attendee@example.test`,
      nextBookableStartIso(new Date()),
    );
    expect(b.status).toBe(201);
    const own = await getBooking(api, a.apiKey, b.uid);
    expect(own.status, "key A reads A's booking").toBe(200);
  });

  test("NEW-CAL-4 key A cannot read B's resource", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const a = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("keya"));
    run.onCleanup(() => a.dispose());
    const bUser = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("keyb"));
    run.onCleanup(() => bUser.dispose());
    const et = await createEventType(api, bUser, "p5 scope b");
    const booking = await createBooking(
      api,
      bUser.apiKey,
      et,
      `${prefix}-attendee@example.test`,
      nextBookableStartIso(new Date()),
    );
    expect(booking.status).toBe(201);
    const cross = await getBooking(api, a.apiKey, booking.uid);
    const after = await getBooking(api, bUser.apiKey, booking.uid);
    expect(bookingStatusOf(after.body), "B's booking state (observed)").toBe("accepted");
    expect([401, 403, 404], `key A on B's booking, status ${cross.status}`).toContain(cross.status);
  });
});
