// API v2 booking helpers for the lane specs (D-CAL-B29: PUT maps to reschedule, DELETE maps to cancel,
// because the v2 bookings API exposes POST /reschedule and POST /cancel and no PUT or DELETE).
// The fork routes: apps/api/v2/src/platform/bookings/2024-08-13/controllers/bookings.controller.ts
// (create :105, get :190, reschedule :296, cancel :336) and event types (2024-06-14, create :83).
import type { APIRequestContext } from "@playwright/test";
import { v2, V2_BOOKINGS_VERSION, V2_EVENT_TYPES_VERSION, type CalActor } from "./actor.ts";

export interface BookingRef {
  readonly uid: string;
  readonly status: number;
}

export async function createEventType(
  api: APIRequestContext,
  actor: CalActor,
  title: string,
): Promise<number> {
  const res = await v2(api, actor.apiKey, "POST", "/v2/event-types", V2_EVENT_TYPES_VERSION, {
    title,
    slug: `${actor.userPrefix}-${actor.label}-${Date.now()}`,
    lengthInMinutes: 30,
  });
  if (res.status !== 201) throw new Error(`EVENT_TYPE_FAILED status ${res.status}`);
  return (res.body as { data: { id: number } }).data.id;
}

/** Booking created with `apiKey`; `attendeeEmail` must not be a Cal user (a stranger stays a stranger). */
export async function createBooking(
  api: APIRequestContext,
  apiKey: string,
  eventTypeId: number,
  attendeeEmail: string,
  start: string,
): Promise<BookingRef> {
  const res = await v2(api, apiKey, "POST", "/v2/bookings", V2_BOOKINGS_VERSION, {
    start,
    eventTypeId,
    attendee: { name: "p5 attendee", email: attendeeEmail, timeZone: "UTC" },
  });
  const uid = (res.body as { data?: { uid?: string } } | null)?.data?.uid ?? "";
  return { uid, status: res.status };
}

export async function getBooking(api: APIRequestContext, apiKey: string | null, uid: string) {
  return v2(api, apiKey, "GET", `/v2/bookings/${uid}`, V2_BOOKINGS_VERSION);
}

export async function rescheduleBooking(
  api: APIRequestContext,
  apiKey: string | null,
  uid: string,
  start: string,
) {
  return v2(api, apiKey, "POST", `/v2/bookings/${uid}/reschedule`, V2_BOOKINGS_VERSION, { start });
}

export async function cancelBooking(api: APIRequestContext, apiKey: string | null, uid: string) {
  return v2(api, apiKey, "POST", `/v2/bookings/${uid}/cancel`, V2_BOOKINGS_VERSION, {
    cancellationReason: "p5 lane probe",
  });
}

/** The booking status string from a GET body (data.status), or null. */
export function bookingStatusOf(body: unknown): string | null {
  const status = (body as { data?: { status?: unknown } } | null)?.data?.status;
  return typeof status === "string" ? status : null;
}
