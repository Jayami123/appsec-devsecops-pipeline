# Public drafts index

Every public finding and public case in the findings ledger, with its ledger status. Status is copied from `docs/findings/ledger.json` and changes only through the ledger. The thirteen held-private entries are at the end, as ID and status only.

Read with [the technical guide](../technical-guide.md) and the [threat models](../threat-models/).

## Public findings

| Finding ID | Case ID | Finding status | Severity | Title |
|---|---|---|---|---|
| P5-CAL-WH-002 | P5-CAL-WH-002 | product-bug-suspected | Medium | Replay of a captured valid signed request |
| P5-CAL-WH-003 | P5-CAL-WH-003 | product-bug-suspected | Low | Stale timestamp with recomputed signature |
| P5-MED-AUTHZ-001 | P5-MED-AUTHZ-001 | product-bug-suspected | High | Customer B cannot take over or mutate customer A's cart through a customer-authenticated route |
| P5-TW-MASS-001 | P5-TW-MASS-001 | product-bug-suspected | Medium | Client-supplied id, createdBy, deletedAt ignored |
| P5-CAL-TOK-001 | P5-CAL-TOK-001 | confirmed-product-bug | Medium | Reset token concurrent redemption |

## Public cases by product

### Cal.com (22)

| Case ID | Ledger status |
|---|---|
| P5-CAL-AUTHZ-001 | verified |
| P5-CAL-AUTHZ-002 | verified |
| P5-CAL-CAP-001 | planned |
| P5-CAL-TEAM-001 | gated |
| P5-CAL-WH-002 | planned |
| P5-CAL-WH-003 | planned |
| P5-CAL-CRON-001 | verified |
| P5-CAL-OAUTH-001 | verified |
| P5-CAL-OAUTH-002 | verified |
| P5-CAL-2FA-001 | verified |
| P5-CAL-TOK-001 | confirmed-product-bug |
| P5-CAL-RL-002 | verified |
| P5-CAL-XSS-001 | verified |
| P5-CAL-XSS-002 | verified |
| P5-CAL-RED-001 | verified |
| P5-CAL-CSV-001 | gated |
| P5-CAL-HDR-001 | verified |
| P5-CAL-CSV-002 | gated |
| P5-CAL-WH-001 | alias |
| P5-CAL-WH-004 | alias |
| P5-CAL-CRON-002 | alias |
| P5-CAL-RL-001 | dropped |

### Documenso (11)

| Case ID | Ledger status |
|---|---|
| P5-DOC-AUTHZ-001 | verified |
| P5-DOC-AUTHZ-002 | verified |
| P5-DOC-RBAC-001 | gated |
| P5-DOC-HDR-001 | verified |
| P5-DOC-OIDC-001 | verified |
| P5-DOC-OIDC-002 | verified |
| P5-DOC-TOK-001 | alias |
| P5-DOC-RL-001 | alias |
| P5-DOC-RL-002 | alias |
| P5-DOC-RL-003 | alias |
| P5-DOC-SESS-001 | dropped |

### Medusa (12)

| Case ID | Ledger status |
|---|---|
| P5-MED-WH-001 | gated |
| P5-MED-WH-002 | gated |
| P5-MED-AUTHZ-001 | planned |
| P5-MED-AUTHZ-002 | verified |
| P5-MED-AUTHZ-003 | verified |
| P5-MED-RBAC-001 | gated |
| P5-MED-FIELD-001 | verified |
| P5-MED-RL-001 | verified |
| P5-MED-CORS-001 | verified |
| P5-MED-FUZZ-001 | verified |
| P5-MED-HDR-001 | verified |
| P5-MED-WH-003 | alias |

### Repository (pipeline) (5)

| Case ID | Ledger status |
|---|---|
| P5-SCAN-001 | verified |
| P5-SCAN-002 | verified |
| P5-SCAN-003 | verified |
| P5-SCAN-004 | planned |
| P5-SCAN-005 | planned |

### Twenty (22)

| Case ID | Ledger status |
|---|---|
| P5-TW-MT-001 | verified |
| P5-TW-RBAC-001 | verified |
| P5-TW-RLS-001 | planned |
| P5-TW-RLS-002 | gated |
| P5-TW-RLS-003 | gated |
| P5-TW-MASS-001 | planned |
| P5-TW-SSRF-001 | gated |
| P5-TW-INJ-001 | verified |
| P5-TW-RL-001 | verified |
| P5-TW-RL-002 | verified |
| P5-TW-SEC-001 | gated |
| P5-TW-FUZZ-001 | verified |
| P5-TW-HDR-001 | gated |
| P5-TW-SND-001 | gated |
| P5-TW-SND-002 | gated |
| P5-TW-SND-003 | gated |
| P5-TW-SND-004 | gated |
| P5-TW-GQL-001 | verified |
| P5-TW-GQL-003 | verified |
| P5-TW-GQL-004 | gated |
| P5-TW-GQL-005 | verified |
| P5-TW-GQL-006 | verified |

Public cases total 72: alias 8, confirmed-product-bug 1, dropped 2, gated 17, planned 8, verified 36.

## Held-private entries (ID and status only)

| Private ID | Ledger status |
|---|---|
| P5-DOC-TOK-002 | held-private |
| P5-TW-TOK-001 | held-private |
| P2-TW-BUG-004 | held-private |
| P2-MED-WH-006 | held-private |
| P6-OBS-DOC-003 | held-private |
| P6-OBS-TW-001 | held-private |
| MI-3 | held-private |
| MI-18 | held-private |
| P5-TW-GQL-002 | held-private |
| P5-DOC-PF-001 | held-private |
| P5-DOC-OIDC-003 | held-private |
| P5-TW-MT-002 | confirmed-product-bug |
| NEW-TW-5 | confirmed-product-bug |

Private entries total 13.

