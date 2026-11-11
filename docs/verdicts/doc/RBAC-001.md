# RBAC-001: EVERYONE role visibility (P2) - GATED

| Verdict type | none built |
| Gate | GATED BY EVIDENCE: a default-role member of the owner's organisation cannot be placed on the owner's envelopes through the v2 contract. ZCreateEnvelopePayloadSchema has no team selector (packages/trpc/server/envelope-router/create-envelope.types.ts:34-48), and visibility is applied inside the team the member belongs to. The invite path is read: organisation-router create input (create-organisation-member-invites.types.ts:15-23), accept input (accept-organisation-member-invite.types.ts:3-4), mail link /organisation/invite/<token> (packages/email/templates/organisation-invite.tsx:65). What is missing: the team-scoped envelope creation route. |
| Test file | reserved path; no test file exists |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (round 2) | DOCKER BLOCKED at 06:40Z on 2026-11-11 (no dockerd running; the session hook owns dockerd, so it was not started by hand). No local live run. The CI run ID for PR #28 is the authoritative result. |
