# Security scope (P5)

Decision D13 in the master plan (`docs/plans/2026-11-08-p5-master-plan.md`, section 3.1).

## In scope

- Local forks of the four pinned products (Cal, Documenso, Medusa starter with core `@medusajs/medusa` 2.21.2, Twenty), each at a pinned commit SHA.
- Pinned container images, by tag or digest, run on local harness stacks.
- This repository's own pipeline security: workflows, scripts, configuration and the findings ledger.

## Out of scope

- Any third-party or production target. Nothing is tested against a live service.
- Active DAST on pull requests. Active scanning runs only by manual dispatch on a throwaway stack (plan D11).
- Load and capacity (P6).
- A complete product audit, and payload-level detail for private-first items.

## Payloads

Test design records what an actor attempts, at the level of the abuse case. It does not record payload bodies, literals, or secrets. Redact every artefact before upload.

## Private-first items

Private-first items are recorded by ID and status only (plan section 4.7). The ledger `private` section holds `{ "id", "status" }` entries and nothing else. No title, product, note, payload, test name, fixture or commit text is written for them, in any file. There is no keyword-matching CI check for their IDs (plan D3); the pull request checklist enforces this.
