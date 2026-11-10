// P5-CAL-AUTHZ-002: keyed mutations succeed (control); anonymous mutations are refused.
// Verb mapping (D-CAL-B29): POST = create booking, PATCH = reschedule, DELETE = cancel.
// The anonymous POST may be the public booker flow by design; a 2xx there is a design verdict, not a
// pass of "refused" (decision D-CAL-B34), so that title asserts the plan property and reports as found.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  nextBookableStartIso,
  type CalActor,
} from "../../../src/lanes/cal/actor.ts";
import {
  cancelBooking,
  createBooking,
  createEventType,
  getBooking,
  rescheduleBooking,
  bookingStatusOf,
} from "../../../src/lanes/cal/booking.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";
import { V2_BOOKINGS_VERSION, v2 } from "../../../src/lanes/cal/actor.ts";

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

async function setup(run: { onCleanup(step: () => Promise<unknown>): void }, label: string) {
  const prefix = currentRunPrefix();
  const api = await apiContext();
  run.onCleanup(() => api.dispose());
  const owner: CalActor = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, label);
  run.onCleanup(() => owner.dispose());
  const eventTypeId = await createEventType(api, owner, `p5 ${label}`);
  const attendee = `${prefix}-attendee@example.test`;
  const booking = await createBooking(
    api,
    owner.apiKey,
    eventTypeId,
    attendee,
    nextBookableStartIso(new Date()),
  );
  expect(booking.status, "owner creates booking").toBe(201);
  return { api, owner, eventTypeId, attendee, uid: booking.uid };
}

test.describe("P5-CAL-AUTHZ-002 anonymous mutations", () => {
  test("P5-CAL-AUTHZ-002 keyed request succeeds", async ({ run }) => {
    const { api, owner, eventTypeId, attendee, uid } = await setup(run, "keyed");
    const reschedule = await rescheduleBooking(
      api,
      owner.apiKey,
      uid,
      nextBookableStartIso(new Date(), 5),
    );
    expect(reschedule.status, "keyed PATCH (reschedule)").toBeLessThan(300);
    // Reschedule creates a new uid and cancels the old one (D-CAL-B35): the cancel uses the new uid.
    const rescheduledUid =
      (reschedule.body as { data?: { uid?: string } } | null)?.data?.uid ?? uid;
    const create = await createBooking(
      api,
      owner.apiKey,
      eventTypeId,
      attendee,
      nextBookableStartIso(new Date(), 20),
    );
    expect(create.status, `keyed POST (create): ${JSON.stringify(create.body).slice(0, 240)}`).toBe(
      201,
    );
    const cancel = await cancelBooking(api, owner.apiKey, rescheduledUid);
    expect(cancel.status, "keyed DELETE (cancel)").toBeLessThan(300);
  });

  test("P5-CAL-AUTHZ-002 anonymous POST is refused", async ({ run }) => {
    const { api, eventTypeId, attendee } = await setup(run, "anonpost");
    const anon = await v2(api, null, "POST", "/v2/bookings", V2_BOOKINGS_VERSION, {
      start: nextBookableStartIso(new Date(), 7),
      eventTypeId,
      attendee: { name: "p5 anon", email: attendee, timeZone: "UTC" },
    });
    expect([401, 403], "anonymous create is refused").toContain(anon.status);
  });

  test("P5-CAL-AUTHZ-002 anonymous PATCH is refused", async ({ run }) => {
    const { api, owner, uid } = await setup(run, "anonpatch");
    const anon = await rescheduleBooking(api, null, uid, nextBookableStartIso(new Date(), 5));
    // State is read before the refusal assertion so an accepted anonymous reschedule is visible.
    const after = await getBooking(api, owner.apiKey, uid);
    expect(
      bookingStatusOf(after.body),
      "booking state after the anonymous attempt (observed)",
    ).toBe("accepted");
    expect([401, 403], `anonymous reschedule, status ${anon.status}`).toContain(anon.status);
  });

  test("P5-CAL-AUTHZ-002 anonymous DELETE is refused", async ({ run }) => {
    const { api, owner, uid } = await setup(run, "anondelete");
    const anon = await cancelBooking(api, null, uid);
    const after = await getBooking(api, owner.apiKey, uid);
    expect(
      bookingStatusOf(after.body),
      "booking state after the anonymous attempt (observed)",
    ).toBe("accepted");
    expect([401, 403], `anonymous cancel, status ${anon.status}`).toContain(anon.status);
  });
});
