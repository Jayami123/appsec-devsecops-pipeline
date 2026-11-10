// P5-CAL-AUTHZ-001: an owner's booking is readable and mutable by the owner (control) and refused to a
// stranger (negative). Verb mapping (D-CAL-B29): GET = booking read, PUT = reschedule, DELETE = cancel.
// Routes: apps/api/v2/src/platform/bookings/2024-08-13/controllers/bookings.controller.ts:190, :296, :336.
// Each negative builds its own owner and stranger fixtures (a negative never reads a control's state).
// The attendee is a non-user address, so the stranger is neither host nor attendee (D-CAL-B32).
// Each negative reads the owner's booking state BEFORE asserting the refusal, so the observed state is
// recorded even when the refusal assertion fails (a successful stranger mutation is then visible).
// The matrix is a declared constant (D-CAL-B39): Playwright starts a fresh worker after a failing test,
// so rows pushed by earlier tests do not survive to the matrix test.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  nextBookableStartIso,
  type CalActor,
} from "../../../src/lanes/cal/actor.ts";
import {
  bookingStatusOf,
  cancelBooking,
  createBooking,
  createEventType,
  getBooking,
  rescheduleBooking,
} from "../../../src/lanes/cal/booking.ts";
import { assertCovered, type MatrixRow } from "../../../src/security/matrix.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

const CASE = "P5-CAL-AUTHZ-001";
/** Declared cells this file claims to cover; each cell is asserted by the test named in its caseId. */
const MATRIX: readonly MatrixRow[] = [
  { actor: "owner", resource: "booking", verb: "GET", expected: "allow", caseId: CASE },
  { actor: "owner", resource: "booking", verb: "PUT", expected: "allow", caseId: CASE },
  { actor: "owner", resource: "booking", verb: "DELETE", expected: "allow", caseId: CASE },
  { actor: "other", resource: "booking", verb: "GET", expected: "allow", caseId: CASE },
  { actor: "other", resource: "booking", verb: "GET", expected: "deny-4xx", caseId: CASE },
  { actor: "other", resource: "booking", verb: "PUT", expected: "deny-4xx", caseId: CASE },
  { actor: "other", resource: "booking", verb: "DELETE", expected: "deny-4xx", caseId: CASE },
];
const REFUSED: readonly number[] = [401, 403, 404];

function webBase(): string {
  return loadEnv().CAL_BASE_URL.replace(/\/$/, "");
}

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

/** Creates an event type and one booking owned by `actor`. The attendee is a non-user address. */
async function ownedBooking(
  api: APIRequestContext,
  actor: CalActor,
  prefix: string,
  start: string,
) {
  const eventTypeId = await createEventType(api, actor, `p5 ${actor.label}`);
  const booking = await createBooking(
    api,
    actor.apiKey,
    eventTypeId,
    `${prefix}-attendee@example.test`,
    start,
  );
  expect(booking.status, `${actor.label} creates a booking`).toBe(201);
  return booking.uid;
}

test.describe("P5-CAL-AUTHZ-001 owner booking", () => {
  test("P5-CAL-AUTHZ-001 owner GET/PUT/DELETE succeed", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(webBase(), prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const uid = await ownedBooking(api, owner, prefix, nextBookableStartIso(new Date()));

    // Control first: the owner reads, reschedules and cancels its own booking.
    const before = await getBooking(api, owner.apiKey, uid);
    expect(before.status, "owner GET own booking").toBe(200);
    expect(bookingStatusOf(before.body), "status before").toBe("accepted");

    const put = await rescheduleBooking(
      api,
      owner.apiKey,
      uid,
      nextBookableStartIso(new Date(), 5),
    );
    expect(put.status, "owner reschedules own booking").toBeLessThan(300);
    // Reschedule creates a new booking with a new uid and cancels the old one (D-CAL-B35).
    const rescheduledUid = (put.body as { data?: { uid?: string } } | null)?.data?.uid ?? uid;

    const del = await cancelBooking(api, owner.apiKey, rescheduledUid);
    expect(del.status, "owner cancels own booking").toBeLessThan(300);

    const after = await getBooking(api, owner.apiKey, rescheduledUid);
    expect(bookingStatusOf(after.body), "status after cancel").toBe("cancelled");
  });

  test("P5-CAL-AUTHZ-001 other user cannot GET the owner booking", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(webBase(), prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const stranger = await createThrowawayActor(webBase(), prefix, labelFor("other"));
    run.onCleanup(() => stranger.dispose());
    const strangerUid = await ownedBooking(api, stranger, prefix, nextBookableStartIso(new Date()));
    const ownerUid = await ownedBooking(api, owner, prefix, nextBookableStartIso(new Date(), 9));

    // Independent control: the other user reads its own booking.
    const control = await getBooking(api, stranger.apiKey, strangerUid);
    expect(control.status, "other GET own booking").toBe(200);

    const denied = await getBooking(api, stranger.apiKey, ownerUid);
    const owned = await getBooking(api, owner.apiKey, ownerUid);
    expect(bookingStatusOf(owned.body), "owner booking state (observed)").toBe("accepted");
    expect(REFUSED, `other GET owner booking, status ${denied.status}`).toContain(denied.status);
  });

  test("P5-CAL-AUTHZ-001 other user cannot PUT the owner booking", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(webBase(), prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const stranger = await createThrowawayActor(webBase(), prefix, labelFor("other"));
    run.onCleanup(() => stranger.dispose());
    const ownerUid = await ownedBooking(api, owner, prefix, nextBookableStartIso(new Date(), 9));
    await ownedBooking(api, stranger, prefix, nextBookableStartIso(new Date(), 13));

    const denied = await rescheduleBooking(
      api,
      stranger.apiKey,
      ownerUid,
      nextBookableStartIso(new Date(), 17),
    );
    const owned = await getBooking(api, owner.apiKey, ownerUid);
    expect(bookingStatusOf(owned.body), "owner booking state after the attempt (observed)").toBe(
      "accepted",
    );
    expect(REFUSED, `other reschedules owner booking, status ${denied.status}`).toContain(
      denied.status,
    );
  });

  test("P5-CAL-AUTHZ-001 other user cannot DELETE the owner booking", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(webBase(), prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const stranger = await createThrowawayActor(webBase(), prefix, labelFor("other"));
    run.onCleanup(() => stranger.dispose());
    const ownerUid = await ownedBooking(api, owner, prefix, nextBookableStartIso(new Date(), 9));
    await ownedBooking(api, stranger, prefix, nextBookableStartIso(new Date(), 13));

    const denied = await cancelBooking(api, stranger.apiKey, ownerUid);
    const owned = await getBooking(api, owner.apiKey, ownerUid);
    expect(bookingStatusOf(owned.body), "owner booking state after the attempt (observed)").toBe(
      "accepted",
    );
    expect(REFUSED, `other cancels owner booking, status ${denied.status}`).toContain(
      denied.status,
    );
  });

  test("P5-CAL-AUTHZ-001 matrix covers every actor, verb and resource", () => {
    assertCovered(MATRIX, ["owner", "other"], ["booking"], ["GET", "PUT", "DELETE"]);
  });
});
