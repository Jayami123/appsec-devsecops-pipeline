# AUTHZ-002: cross-organisation template (P1)

| Verdict type | PASS or PRODUCT BUG (SUSPECTED), per the run |
| Test file | tests/integration/doc/cross-org-template.spec.ts |
| Actors | owner (organisation A, its personal organisation); org-b-member (organisation B, its personal organisation); throwaway, provisioned once per run (D-DOC-B33) |
| Control 1 | org-b-member reads its own organisation's template (same-organisation control; GET /api/v2/template/{id}) |
| Negative 1 | org-b-member reads the owner's template: must be 4xx (owner reads 2xx first) |
| Control 2 | owner creates an envelope from its template (POST /api/v2/template/use, numeric templateId, template-create contract) |
| Negative 2 | org-b-member creates an envelope from the owner's template: must be 4xx |
| Cleanup | every template deleted through its owner in run cleanup |
| Unverified | the numeric legacy template id from secondaryId (template_<n>) and the template-use body are from the vendored contract; the first live run is the check |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (round 2) | DOCKER BLOCKED at 06:40Z on 2026-11-11 (no dockerd running; the session hook owns dockerd, so it was not started by hand). No local live run. The CI run ID for PR #28 is the authoritative result. |
