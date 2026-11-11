// P5-CAL-AUTHZ-002: keyed mutations succeed (control). The anonymous cells record the observed
// capability model as design verdicts (owner rule, B36): the booking uid is a bearer capability, and the
// same OptionalApiAuthGuard chain serves anonymous and keyed callers (bookings.controller.ts:105-106,
// :296-297, :336-337). An authenticated non-participant is the same capability (AUTHZ-001), so these
// titles depend on CAP-001. Verb mapping (D-CAL-B29): POST = create, PATCH = reschedule, DELETE = cancel.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  nextBookableStartIso,
  V2_BOOKINGS_VERSION,
  v2,
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

/** Records a design verdict on the running test, with its CAP-001 dependency. */
function recordDesignVerdict(evidence: string): void {
  test
    .info()
    .annotations.push({ type: "design-verdict", description: `${evidence}; depends on CAP-001` });
  test.info().annotations.push({ type: "depends-on", description: "CAP-001" });
}

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

  test("P5-CAL-AUTHZ-002 anonymous POST follows the public booker flow (design verdict, depends on CAP-001)", async ({
    run,
  }) => {
    recordDesignVerdict(
      "anonymous create: bookings.controller.ts:105-106 (OptionalApiAuthGuard); the create gate applies only to event types that require authentication (bookings.service.ts:169-185)",
    );
    const { api, eventTypeId, attendee } = await setup(run, "anonpost");
    const anon = await v2(api, null, "POST", "/v2/bookings", V2_BOOKINGS_VERSION, {
      start: nextBookableStartIso(new Date(), 7),
      eventTypeId,
      attendee: { name: "p5 anon", email: attendee, timeZone: "UTC" },
    });
    expect(anon.status, "anonymous create follows the booker flow").toBe(201);
  });

  test("P5-CAL-AUTHZ-002 anonymous PATCH follows the uid capability (design verdict, depends on CAP-001)", async ({
    run,
  }) => {
    recordDesignVerdict(
      "anonymous reschedule by uid: bookings.controller.ts:296-297 with booking-uid.guard.ts:8-14 (presence check only)",
    );
    const { api, owner, uid } = await setup(run, "anonpatch");
    const anon = await rescheduleBooking(api, null, uid, nextBookableStartIso(new Date(), 5));
    // State is read before any assertion so the observed outcome is recorded.
    const after = await getBooking(api, owner.apiKey, uid);
    expect(bookingStatusOf(after.body), "old uid after the anonymous reschedule (observed)").toBe(
      "cancelled",
    );
    expect(anon.status, `anonymous reschedule, status ${anon.status}`).toBeLessThan(300);
  });

  test("P5-CAL-AUTHZ-002 anonymous DELETE follows the uid capability (design verdict, depends on CAP-001)", async ({
    run,
  }) => {
    recordDesignVerdict(
      "anonymous cancel by uid: bookings.controller.ts:336-337 (non-seated bookings are cancelled by uid alone, bookings.controller.ts:347)",
    );
    const { api, owner, uid } = await setup(run, "anondelete");
    const anon = await cancelBooking(api, null, uid);
    const after = await getBooking(api, owner.apiKey, uid);
    expect(bookingStatusOf(after.body), "booking state after the anonymous cancel (observed)").toBe(
      "cancelled",
    );
    expect(anon.status, `anonymous cancel, status ${anon.status}`).toBeLessThan(300);
  });
});
