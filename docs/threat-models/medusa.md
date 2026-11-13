# Threat model: Medusa (online store)

One page. Design level only: no payloads, literals, secrets or file paths into the product. Private items appear in the [public drafts index](../public-drafts/index.md) only.

## Assets

- Customer accounts, addresses and contact details.
- Carts and their contents, including guest carts.
- Orders, payment-provider events and their signatures.
- Store admin data: products, prices and exports.
- Webhook signing secrets for payment and fulfilment events (never their values).

## Actors

| Actor | Trust level | Notes |
|---|---|---|
| Anonymous | none | Store front routes and guest carts. |
| Authenticated customer (throwaway) | own data only | Created per run with the run prefix. |
| Other customer (throwaway) | other customer's data | Used for cross-account checks. |
| Payment-provider sender | signed traffic only | Product-initiated events. |
| Store admin | admin scope | Not used by the p5-x lane (decision D-1). |

## Trust boundaries

- Public store API to the application.
- Customer-authenticated routes to the application's per-customer data.
- The application to the database, where cart and order ownership is enforced by the application.
- Inbound signed payment webhooks to the application.
- Admin export to the file the admin downloads.

## Abuse cases

| Abuse-case ID | Description (test-design level) | Boundary crossed |
|---|---|---|
| P5-MED-AUTHZ-001 | A customer acts on another customer's cart through a customer-authenticated route. | Application to database |
| P5-MED-AUTHZ-002, P5-MED-AUTHZ-003 | A customer reads or changes another customer's data. | Application to database |
| P5-MED-WH-001, P5-MED-WH-002 | A signed payment event is replayed or altered. | Inbound webhook |
| P5-MED-WH-003 | Signed inbound event handling (alias; see the alias list). | Inbound webhook |
| P5-MED-FIELD-001 | A client-supplied field the server should set is accepted. | Public API |
| P5-MED-RL-001 | Repeated attempts on a rate-limited route are not limited. | Public API |
| P5-MED-CORS-001 | A cross-origin request from an unlisted origin is allowed. | Browser boundary |

## Controls

- Customer cart and order routes check the caller's identity against the owner. Covering rows: P5-MED-AUTHZ-001 (planned, with a suspected product-bug finding), P5-MED-AUTHZ-002 and P5-MED-AUTHZ-003 (verified).
- Signed payment webhooks are verified against the raw body. Covering rows: P5-MED-WH-001 and P5-MED-WH-002 (gated), P5-MED-WH-003 (alias).
- Server-set fields are not accepted from the client. Covering row: P5-MED-FIELD-001 (verified).
- Rate limits on public routes. Covering row: P5-MED-RL-001 (verified).
- CORS allow-list. Covering row: P5-MED-CORS-001 (verified).
- Input fuzzing against the store contract. Covering row: P5-MED-FUZZ-001 (verified, with a committed baseline).
- Response headers. Covering row: P5-MED-HDR-001 (verified).

## Covering rows

| Row ID | Disposition | Notes |
|---|---|---|
| P5-MED-AUTHZ-001 | planned | Public finding, product-bug-suspected. |
| P5-MED-AUTHZ-002 | verified | Customer data. |
| P5-MED-AUTHZ-003 | verified | Customer data. |
| P5-MED-WH-001 | gated | Payment event handling. |
| P5-MED-WH-002 | gated | Payment event handling. |
| P5-MED-WH-003 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-MED-RBAC-001 | gated | Admin role matrix. |
| P5-MED-FIELD-001 | verified | Server-set fields. |
| P5-MED-RL-001 | verified | Rate limit. |
| P5-MED-CORS-001 | verified | Browser origin policy. |
| P5-MED-FUZZ-001 | verified | Contract fuzzing, committed baseline. |
| P5-MED-HDR-001 | verified | Response headers. |

## Open questions

- P5-MED-AUTHZ-001: the finding's detail is held by the owner; the row stays planned until the owner's review.
- P5-MED-WH-001, P5-MED-WH-002, P5-MED-RBAC-001: gated; the remaining gates are in the [ledger](../findings/ledger.json).
- Admin-scoped checks need a route that does not use the harness admin (decision D-1, option A).
