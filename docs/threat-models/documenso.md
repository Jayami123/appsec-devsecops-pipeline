# Threat model: Documenso (e-signatures)

One page. Design level only: no payloads, literals, secrets or file paths into the product. Private items appear in the [public drafts index](../public-drafts/index.md) only.

## Assets

- Signing documents, recipients and the signed (sealed) result.
- Single-use signing tokens sent to recipients.
- Sign-in sessions and OAuth state for the sign-in provider.
- Webhook secret for subscribers (never its value).
- Team roles that decide who can send, view or void a document.

## Actors

| Actor | Trust level | Notes |
|---|---|---|
| Anonymous | none | Recipient links and public routes. |
| Authenticated user (throwaway) | own data only | Created per run with the run prefix. |
| Other user (throwaway) | other user's data | Used for cross-account checks. |
| Recipient | one document | Holds a single-use token for one signing. |
| Team admin (throwaway) | team scope | Used only where a route needs a team role. |

## Trust boundaries

- Recipient links (token in the URL) to the signing flow.
- Sign-in provider to the application through OAuth.
- The application to the database, with row ownership enforced by the application.
- Outbound webhooks to subscribers (secret header).
- Rate-limited public routes to the application.

## Abuse cases

| Abuse-case ID | Description (test-design level) | Boundary crossed |
|---|---|---|
| P5-DOC-AUTHZ-001, P5-DOC-AUTHZ-002 | A user reads or changes a document of another account or team. | Application to database |
| P5-DOC-OIDC-001 | A consumed OAuth state is presented again. | Sign-in boundary |
| P5-DOC-OIDC-002 | An OAuth callback is used with a state from another session. | Sign-in boundary |
| P5-DOC-RBAC-001 | A team member performs an action their role does not allow. | Application to database |
| P5-DOC-RL-001 to P5-DOC-RL-003 | Repeated attempts on a rate-limited route exceed the limit. | Public API |
| P5-DOC-TOK-001 | A single-use signing token is redeemed more than once. | Recipient link |

## Controls

- A consumed OAuth state is refused and creates no session. Covering row: P5-DOC-OIDC-001 (verified).
- An OAuth state from another session is refused. Covering row: P5-DOC-OIDC-002 (verified).
- Document and team records are checked against the caller. Covering rows: P5-DOC-AUTHZ-001 and P5-DOC-AUTHZ-002 (verified).
- Team role checks. Covering row: P5-DOC-RBAC-001 (gated).
- Single-use signing token. Covering row: P5-DOC-TOK-001 (alias; see the [alias list](../traceability/p7-aliases.md)).
- Rate limits on public routes. Covering rows: P5-DOC-RL-001, P5-DOC-RL-002, P5-DOC-RL-003 (alias).
- Security headers. Covering row: P5-DOC-HDR-001 (verified).

## Covering rows

| Row ID | Disposition | Notes |
|---|---|---|
| P5-DOC-AUTHZ-001 | verified | Cross-account read and write. |
| P5-DOC-AUTHZ-002 | verified | Cross-account read and write. |
| P5-DOC-OIDC-001 | verified | Consumed state refused, no session. |
| P5-DOC-OIDC-002 | verified | Foreign state refused. |
| P5-DOC-HDR-001 | verified | Response headers. |
| P5-DOC-RBAC-001 | gated | Team role matrix. |
| P5-DOC-TOK-001 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-DOC-RL-001 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-DOC-RL-002 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-DOC-RL-003 | alias | See the [alias list](../traceability/p7-aliases.md). |
| P5-DOC-SESS-001 | dropped | Not carried forward. |

## Open questions

- P5-DOC-RBAC-001: team role matrix is gated; the probe for the role set is in the DOC probe record.
- Sign-in control verdicts (P5-DOC-OIDC-001 and P5-DOC-OIDC-002) are verified; no open question remains for them.
