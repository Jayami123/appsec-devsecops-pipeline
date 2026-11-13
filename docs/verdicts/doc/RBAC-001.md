# RBAC-001: EVERYONE role visibility (P2) - GATED

| Verdict type | none built |
| Gate | GATED BY EVIDENCE: a default-role member of the owner's organisation cannot be placed on the owner's envelopes through the v2 contract. ZCreateEnvelopePayloadSchema has no team selector (fork ref held by the owner), and visibility is applied inside the team the member belongs to. The invite path is read: organisation-router create input (fork ref held by the owner), accept input (fork ref held by the owner), mail link /organisation/invite/<token> (fork ref held by the owner). What is missing: the team-scoped envelope creation route. |
| Test file | reserved path; no test file exists |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` fork ref held by the owner) |
| Harness | `qa-portfolio-harness` v0.4.0 fork ref held by the owner) |
| Live status (round 2) | DOCKER BLOCKED at 06:40Z on 2026-11-11 (no dockerd running; the session hook owns dockerd, so it was not started by hand). No local live run. The CI run ID for PR #28 is the authoritative result. |
