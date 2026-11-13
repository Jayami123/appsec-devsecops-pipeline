// NEW-CAL-1: a second user cannot read or mutate the owner's booking sub-resources. Routes (2024-08-13):
// GET /v2/bookings/:uid/references (fork ref held by the owner), POST /v2/bookings/:uid/decline (:494).
// The mutation is the decline route, the only host-side sub-resource mutation that needs no extra fixture.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  labelFor,
  createThrowawayActor,
  nextBookableStartIso,
} from "../../../src/lanes/cal/actor.ts";
import {
  createBooking,
  createEventType,
  getBooking,
  bookingStatusOf,
} from "../../../src/lanes/cal/booking.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";
import { v2, V2_BOOKINGS_VERSION } from "../../../src/lanes/cal/actor.ts";

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

test.describe("P5-CAL-NEW-CAL-1 sub-resources", () => {
  test("NEW-CAL-1 owner reads own sub-resource", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const et = await createEventType(api, owner, "p5 sub");
    const b = await createBooking(
      api,
      owner.apiKey,
      et,
      `${prefix}-attendee@example.test`,
      nextBookableStartIso(new Date()),
    );
    expect(b.status).toBe(201);
    const refs = await v2(
      api,
      owner.apiKey,
      "GET",
      `/v2/bookings/${b.uid}/references`,
      V2_BOOKINGS_VERSION,
    );
    expect(refs.status, "owner reads own references").toBe(200);
  });

  test("NEW-CAL-1 second user cannot mutate owner sub-resource", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const other = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("other"));
    run.onCleanup(() => other.dispose());
    const et = await createEventType(api, owner, "p5 sub");
    const b = await createBooking(
      api,
      owner.apiKey,
      et,
      `${prefix}-attendee@example.test`,
      nextBookableStartIso(new Date()),
    );
    expect(b.status).toBe(201);
    const attempt = await v2(
      api,
      other.apiKey,
      "POST",
      `/v2/bookings/${b.uid}/decline`,
      V2_BOOKINGS_VERSION,
      { reason: "p5" },
    );
    expect([401, 403, 404], "other declines owner booking").toContain(attempt.status);
    const after = await getBooking(api, owner.apiKey, b.uid);
    expect(bookingStatusOf(after.body), "owner booking unchanged").toBe("accepted");
  });
});
