// The seven cron routes under apps/web/app/api/cron/ (cal plan 5.9, fork c2b7ac44). Data only.
// Line numbers are route.ts lines at c2b7ac44 (fork checkout verified by the cal bootstrap).

/** How a caller passes the credential. */
export type CronKeyTransport = "raw-authorization-or-apiKey-query";

export interface CronRoute {
  readonly path: `/api/cron/${string}`;
  readonly method: "GET" | "POST";
  /** "route.ts:<line>" of the key comparison at c2b7ac44. */
  readonly keyCheckLine: string;
  readonly key: "CRON_API_KEY";
  readonly keyTransport: CronKeyTransport;
  /** True when the route also accepts `Bearer ${CRON_SECRET}` in the authorization header. */
  readonly alsoAcceptsBearerCronSecret: boolean;
}

export const CRON_ROUTES: readonly CronRoute[] = [
  {
    path: "/api/cron/bookingReminder",
    method: "POST",
    keyCheckLine: "route.ts:19",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
  {
    path: "/api/cron/calendar-subscriptions-cleanup",
    method: "GET",
    keyCheckLine: "route.ts:19",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: true,
  },
  {
    path: "/api/cron/calendar-subscriptions",
    method: "GET",
    keyCheckLine: "route.ts:27",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: true,
  },
  {
    path: "/api/cron/changeTimeZone",
    method: "POST",
    keyCheckLine: "route.ts:27",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
  {
    path: "/api/cron/selected-calendars",
    method: "GET",
    keyCheckLine: "route.ts:30",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: true,
  },
  {
    path: "/api/cron/syncAppMeta",
    method: "POST",
    keyCheckLine: "route.ts:23",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
  {
    path: "/api/cron/webhookTriggers",
    method: "POST",
    keyCheckLine: "route.ts:11",
    key: "CRON_API_KEY",
    keyTransport: "raw-authorization-or-apiKey-query",
    alsoAcceptsBearerCronSecret: false,
  },
] as const;

/**
 * A cron-style route outside apps/web/app/api/cron/ (found by the cal.md:301 search). It is NOT
 * one of the seven counted rows. Its guard is `Bearer CRON_SECRET` only, no CRON_API_KEY:
 * packages/features/tasker/api/cron.ts:7-8, reached through apps/web/app/api/tasks/cron/route.ts:3-5.
 */
export const EXTRA_CRON_ROUTE = {
  path: "/api/tasks/cron",
  method: "GET",
  guardLine: "packages/features/tasker/api/cron.ts:7-8",
  key: "CRON_SECRET",
  keyTransport: "bearer-authorization-header",
} as const;
