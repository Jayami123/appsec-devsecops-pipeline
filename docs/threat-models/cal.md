# Threat model: Cal.com (booking tool)

One page. Design level only: no payloads, literals, secrets or file paths into the product. Private items appear in the [public drafts index](../public-drafts/index.md) only.

## Assets

- Booking records and event types, including attendee names and contact details.
- Account sign-in state: passwords, two-factor enrolment and OAuth sessions.
- Password-reset tokens (single use by design).
- Webhook signing secrets for subscribers (never their values).
- Team and organisation membership, which controls who sees whose bookings.
- CSV exports of member and booking data.

## Actors

| Actor | Trust level | Notes |
|---|---|---|
| Anonymous | none | Public booking pages and public API routes. |
| Authenticated user (throwaway) | own data only | Created per run with the run prefix. |
| Other user (throwaway) | other user's data | Used for cross-account checks. |
| Operator or admin (throwaway) | organisation admin | Used only where a route needs an admin. |
| Webhook sender | signed traffic only | Product-initiated deliveries. |

## Trust boundaries

- Public HTTP and booking pages to the application API.
- The application to the database, where row ownership is enforced by the application.
- The application to outbound webhook subscribers (signed deliveries).
- Inbound signed webhooks from the calendar and video integrations to the application.
- Export generation to the file the browser or subscriber downloads.

## Abuse cases

| Abuse-case ID | Description (test-design level) | Boundary crossed |
|---|---|---|
| P5-CAL-AUTHZ-001, P5-CAL-AUTHZ-002 | A user reads or changes records owned by another account or team. | Application to database |
| P5-CAL-TOK-001 | Reset token concurrent redemption (public case title; no further detail). | Application to database |
| P5-CAL-WH-002 | A captured, validly signed webhook is delivered a second time. | Inbound webhook |
| P5-CAL-WH-003 | A validly signed webhook is accepted after its timestamp is stale. | Inbound webhook |
| P5-CAL-CSV-002 | A spreadsheet-formula cell in an export is written unchanged. | Export to file |
| P5-CAL-OAUTH-001, P5-CAL-OAUTH-002 | A consumed or foreign OAuth state is accepted. | Sign-in boundary |
| P5-CAL-2FA-001 | Sign-in succeeds without the second factor. | Sign-in boundary |
| P5-CAL-RL-002 | Repeated attempts on a rate-limited route are not limited. | Public API |

## Controls

- Team and booking records are checked against the caller's membership. Covering rows: P5-CAL-AUTHZ-001 (verified), P5-CAL-AUTHZ-002 (verified).
- Single-use reset tokens. Covering row: P5-CAL-TOK-001 (confirmed product bug; detail held by the owner).
- Outbound webhooks are signed; the signature covers the body. Covering rows: P5-CAL-WH-002 and P5-CAL-WH-003 (both planned, with suspected product-bug findings).
- OAuth state is single use and bound to the request. Covering rows: P5-CAL-OAUTH-001 and P5-CAL-OAUTH-002 (verified).
- Two-factor enrolment and check. Covering row: P5-CAL-2FA-001 (verified).
- Rate limiting on the sign-in and reset routes. Covering row: P5-CAL-RL-002 (verified). P5-CAL-RL-001 is dropped.
- Formula neutralisation in CSV export. Covering rows: P5-CAL-CSV-001 and P5-CAL-CSV-002 (both gated).

## Covering rows

| Row ID | Disposition | Notes |
|---|---|---|
| P5-CAL-AUTHZ-001 | verified | Cross-account read and write. |
| P5-CAL-AUTHZ-002 | verified | Cross-account read and write. |
| P5-CAL-TOK-001 | confirmed-product-bug | Public finding; detail held by the owner. |
| P5-CAL-WH-002 | planned | Public finding, product-bug-suspected. |
| P5-CAL-WH-003 | planned | Public finding, product-bug-suspected. |
| P5-CAL-WH-001 | alias | Canonical P2 row; residual covered by P5-CAL-WH-002. |
| P5-CAL-WH-004 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-CAL-CRON-002 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-CAL-CRON-001 | verified | Scheduled job behaviour. |
| P5-CAL-OAUTH-001 | verified | Sign-in boundary. |
| P5-CAL-OAUTH-002 | verified | Sign-in boundary. |
| P5-CAL-2FA-001 | verified | Second factor. |
| P5-CAL-RL-002 | verified | Rate limit. |
| P5-CAL-RL-001 | dropped | Not carried forward. |
| P5-CAL-CSV-001 | gated | Export neutralisation (organisation members). |
| P5-CAL-CSV-002 | gated | Export control with the shared corpus. |
| P5-CAL-TEAM-001 | gated | Team boundary. |
| P5-CAL-CAP-001 | planned | Capability check. |

## Open questions

- P5-CAL-CSV-001: organisation for the export is unprobed (probe P-5 in the CAL plan).
- P5-CAL-CSV-002: gated on the Medusa admin decision (D-1) and the Twenty leg. Remaining gates are in the [ledger](../findings/ledger.json).
- P5-CAL-TEAM-001: team-role matrix not yet probed.
