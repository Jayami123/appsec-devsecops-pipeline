// The seven cron routes (cal plan 5.9). Data only. Product source references are held by the owner.

/** How a caller passes the credential. */
export type CronKeyTransport = "raw-authorization-or-apiKey-query";

export interface CronRoute {
  readonly path: `/api/cron/${string}`;
  readonly method: "GET" | "POST";
  readonly key: "CRON_API_KEY";
  readonly keyTransport: CronKeyTransport;
  /** True when the route also accepts `Bearer ${CRON_SECRET}` in the authorization header. */
  readonly alsoAcceptsBearerCronSecret: boolean;
}

export const CRON_ROUTES: readonly CronRoute[] = [
  {
    path: "/api/cron/bookingReminder",
    method: "POST",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
  {
    path: "/api/cron/calendar-subscriptions-cleanup",
    method: "GET",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: true,
  },
  {
    path: "/api/cron/calendar-subscriptions",
    method: "GET",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: true,
  },
  {
    path: "/api/cron/changeTimeZone",
    method: "POST",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
  {
    path: "/api/cron/selected-calendars",
    method: "GET",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: true,
  },
  {
    path: "/api/cron/syncAppMeta",
    method: "POST",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
  {
    path: "/api/cron/webhookTriggers",
    method: "POST",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
] as const;

/**
 * A cron-style route outside the seven counted rows. Its guard is `Bearer CRON_SECRET` only, no CRON_API_KEY.
 * Product source references are held by the owner.
 */
export const EXTRA_CRON_ROUTE = {
  path: "/api/tasks/cron",
  method: "GET",
  key: "CRON_SECRET",
  keyTransport: "bearer-authorization-header",
} as const;
