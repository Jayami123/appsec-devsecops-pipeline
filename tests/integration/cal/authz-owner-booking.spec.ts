// P5-CAL-AUTHZ-001: an owner's booking is readable and mutable by the owner (control) and refused to a
// stranger (negative). Verb mapping (D-CAL-B29): GET = booking read, PUT = reschedule, DELETE = cancel.
// Routes: apps/api/v2/src/platform/bookings/2024-08-13/controllers/bookings.controller.ts:190, :296, :336.
// Each negative test builds its own owner and stranger fixtures (a negative never reads a control's
// state). The attendee email is a non-user address, so the stranger is not an attendee (D-CAL-B32).
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

const rows: MatrixRow[] = [];
const REFUSED: readonly number[] = [401, 403, 404];

function webBase(): string {
  return loadEnv().CAL_BASE_URL.replace(/\/$/, "");
}

async function apiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, "") });
}

/** Creates an actor, an event type, and one booking owned by it. Cleanup is registered by the caller. */
async function ownedBooking(api: APIRequestContext, actor: CalActor, prefix: string) {
  const eventTypeId = await createEventType(api, actor, `p5 ${actor.label}`);
  const booking = await createBooking(
    api,
    actor.apiKey,
    eventTypeId,
    `${prefix}-attendee@example.test`,
    nextBookableStartIso(new Date()),
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
    const uid = await ownedBooking(api, owner, prefix);

    // Control first: the owner reads, reschedules and cancels its own booking.
    const before = await getBooking(api, owner.apiKey, uid);
    expect(before.status, "owner GET own booking").toBe(200);
    expect(bookingStatusOf(before.body), "status before").toBe("accepted");
    rows.push({
      actor: "owner",
      resource: "booking",
      verb: "GET",
      expected: "allow",
      caseId: "P5-CAL-AUTHZ-001",
    });

    const put = await rescheduleBooking(
      api,
      owner.apiKey,
      uid,
      nextBookableStartIso(new Date(), 5),
    );
    expect(put.status, "owner reschedules own booking").toBeLessThan(300);
    // Reschedule creates a new booking with a new uid and cancels the old one (D-CAL-B35).
    const rescheduledUid = (put.body as { data?: { uid?: string } } | null)?.data?.uid ?? uid;
    rows.push({
      actor: "owner",
      resource: "booking",
      verb: "PUT",
      expected: "allow",
      caseId: "P5-CAL-AUTHZ-001",
    });

    const del = await cancelBooking(api, owner.apiKey, rescheduledUid);
    expect(del.status, "owner cancels own booking").toBeLessThan(300);
    rows.push({
      actor: "owner",
      resource: "booking",
      verb: "DELETE",
      expected: "allow",
      caseId: "P5-CAL-AUTHZ-001",
    });

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
    const ownUid = await ownedBooking(api, stranger, prefix);
    const ownerUid = await ownedBooking(api, owner, prefix);

    // Independent control: the other user reads its own booking.
    const control = await getBooking(api, stranger.apiKey, ownUid);
    expect(control.status, "other GET own booking").toBe(200);
    rows.push({
      actor: "other",
      resource: "booking",
      verb: "GET",
      expected: "allow",
      caseId: "P5-CAL-AUTHZ-001",
    });

    const denied = await getBooking(api, stranger.apiKey, ownerUid);
    rows.push({
      actor: "other",
      resource: "booking",
      verb: "GET",
      expected: "deny-4xx",
      caseId: "P5-CAL-AUTHZ-001",
    });
    expect(REFUSED, "other GET owner booking").toContain(denied.status);

    const unchanged = await getBooking(api, owner.apiKey, ownerUid);
    expect(bookingStatusOf(unchanged.body), "owner booking unchanged").toBe("accepted");
  });

  test("P5-CAL-AUTHZ-001 other user cannot PUT the owner booking", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(webBase(), prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const stranger = await createThrowawayActor(webBase(), prefix, labelFor("other"));
    run.onCleanup(() => stranger.dispose());
    const ownerUid = await ownedBooking(api, owner, prefix);
    await ownedBooking(api, stranger, prefix);

    const denied = await rescheduleBooking(
      api,
      stranger.apiKey,
      ownerUid,
      nextBookableStartIso(new Date(), 5),
    );
    rows.push({
      actor: "other",
      resource: "booking",
      verb: "PUT",
      expected: "deny-4xx",
      caseId: "P5-CAL-AUTHZ-001",
    });
    expect(REFUSED, "other reschedules owner booking").toContain(denied.status);

    const unchanged = await getBooking(api, owner.apiKey, ownerUid);
    expect(bookingStatusOf(unchanged.body), "owner booking still accepted").toBe("accepted");
  });

  test("P5-CAL-AUTHZ-001 other user cannot DELETE the owner booking", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await apiContext();
    run.onCleanup(() => api.dispose());
    const owner = await createThrowawayActor(webBase(), prefix, labelFor("owner"));
    run.onCleanup(() => owner.dispose());
    const stranger = await createThrowawayActor(webBase(), prefix, labelFor("other"));
    run.onCleanup(() => stranger.dispose());
    const ownerUid = await ownedBooking(api, owner, prefix);
    await ownedBooking(api, stranger, prefix);

    const denied = await cancelBooking(api, stranger.apiKey, ownerUid);
    rows.push({
      actor: "other",
      resource: "booking",
      verb: "DELETE",
      expected: "deny-4xx",
      caseId: "P5-CAL-AUTHZ-001",
    });
    expect(REFUSED, "other cancels owner booking").toContain(denied.status);

    const unchanged = await getBooking(api, owner.apiKey, ownerUid);
    expect(bookingStatusOf(unchanged.body), "owner booking still accepted").toBe("accepted");
  });

  test("P5-CAL-AUTHZ-001 matrix covers every actor, verb and resource", () => {
    assertCovered(rows, ["owner", "other"], ["booking"], ["GET", "PUT", "DELETE"]);
  });
});
