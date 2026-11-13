# Threat model: Twenty (CRM)

One page. Design level only: no payloads, literals, secrets or file paths into the product. Private items appear in the [public drafts index](../public-drafts/index.md) only.

## Assets

- Companies, people, opportunities and notes, which hold customer contact data.
- Workspace membership and roles.
- API keys and access tokens (never their values).
- Webhook signing secrets for subscribers (never their values).
- CSV and spreadsheet exports of records.
- Billing events from the payment provider.

## Actors

| Actor | Trust level | Notes |
|---|---|---|
| Anonymous | none | Sign-in and public routes. |
| Authenticated workspace member (throwaway) | own workspace only | Created per run with the run prefix. |
| Other workspace member (throwaway) | other workspace's data | Used for cross-workspace checks. |
| Workspace admin (throwaway) | workspace admin | Only where a route needs an admin. |
| Webhook sender | signed traffic only | Product-initiated and billing events. |

## Trust boundaries

- Public HTTP and GraphQL API to the application.
- The application to the database, where workspace isolation is enforced by the application and by row-level rules.
- The application to outbound webhook subscribers (signed deliveries).
- Inbound signed billing events to the application.
- Record export to the file the user downloads in the browser.

## Abuse cases

| Abuse-case ID | Description (test-design level) | Boundary crossed |
|---|---|---|
| P5-TW-RBAC-001 | A member performs an action their role does not allow. | Application to database |
| P5-TW-RLS-001 to P5-TW-RLS-003 | A query returns or changes rows from another workspace. | Application to database |
| P5-TW-MASS-001 | A client supplies a field the server should set itself and the server accepts it. | Public API |
| P5-TW-MT-001 | A member reads or changes another workspace's record through the API. | Public API |
| P5-TW-GQL-001 to P5-TW-GQL-006 | A GraphQL query exceeds its intended scope or limit. | Public API |
| P5-TW-SSRF-001 | A server-side fetch is directed at an address the caller should not reach. | Application to network |
| P5-TW-INJ-001 | Untrusted input is interpreted as query or command text. | Application to database |
| P5-TW-SND-001 to P5-TW-SND-004 | Outbound delivery is sent to a target or with content the subscriber should not receive. | Outbound webhook |
| P5-TW-RL-001, P5-TW-RL-002 | Repeated attempts on a rate-limited route are not limited. | Public API |

## Controls

- Role checks on every write route. Covering row: P5-TW-RBAC-001 (verified).
- Workspace isolation for records. Covering rows: P5-TW-MT-001 (verified), P5-TW-RLS-001 (planned), P5-TW-RLS-002 and P5-TW-RLS-003 (gated).
- Server-set fields are not accepted from the client. Covering row: P5-TW-MASS-001 (planned, with a suspected product-bug finding).
- Outbound target checks. Covering row: P5-TW-SSRF-001 (gated).
- Input handling. Covering row: P5-TW-INJ-001 (verified).
- Rate limits. Covering rows: P5-TW-RL-001 and P5-TW-RL-002 (verified).
- Outbound signed deliveries. Covering rows: P5-TW-SND-001 to P5-TW-SND-004 (gated).
- GraphQL limits. Covering rows: P5-TW-GQL-001, P5-TW-GQL-003, P5-TW-GQL-005, P5-TW-GQL-006 (verified); P5-TW-GQL-004 (gated).
- Contract fuzzing against the API. Covering row: P5-TW-FUZZ-001 (verified).
- Security headers. Covering row: P5-TW-HDR-001 (gated).

## Covering rows

| Row ID | Disposition | Notes |
|---|---|---|
| P5-TW-MT-001 | verified | Cross-workspace record access. |
| P5-TW-RBAC-001 | verified | Role checks. |
| P5-TW-RLS-001 | planned | Row-level isolation. |
| P5-TW-RLS-002 | gated | Row-level isolation. |
| P5-TW-RLS-003 | gated | Row-level isolation. |
| P5-TW-MASS-001 | planned | Public finding, product-bug-suspected. |
| P5-TW-SSRF-001 | gated | Outbound target. |
| P5-TW-INJ-001 | verified | Input handling. |
| P5-TW-RL-001 | verified | Rate limit. |
| P5-TW-RL-002 | verified | Rate limit. |
| P5-TW-SEC-001 | gated | Database role boundary. |
| P5-TW-FUZZ-001 | verified | Contract fuzzing. |
| P5-TW-HDR-001 | gated | Response headers. |
| P5-TW-SND-001 | gated | Outbound delivery. |
| P5-TW-SND-002 | gated | Outbound delivery. |
| P5-TW-SND-003 | gated | Outbound delivery. |
| P5-TW-SND-004 | gated | Outbound delivery. |
| P5-TW-GQL-001 | verified | GraphQL scope. |
| P5-TW-GQL-003 | verified | GraphQL scope. |
| P5-TW-GQL-004 | gated | GraphQL limiter; runs on its own fresh stack. |
| P5-TW-GQL-005 | verified | GraphQL scope. |
| P5-TW-GQL-006 | verified | GraphQL scope. |

## Open questions

- P5-TW-RLS-002, P5-TW-RLS-003, P5-TW-SSRF-001, P5-TW-SEC-001: gated on the tw lane's role and network probes; see the [ledger](../findings/ledger.json).
- Throwaway sign-up for the closeout Twenty leg is unprobed (probe P-4 in the X probe record). The tw lane creates members through a workspace-admin invite today.
- P5-TW-HDR-001 and P5-TW-SND-001 to P5-TW-SND-004: gated; no open probe beyond the lane plan.
