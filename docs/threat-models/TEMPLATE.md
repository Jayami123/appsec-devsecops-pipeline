# Threat model: <product or surface>

Copy this file to `docs/threat-models/<product>-<surface>.md`. One page. Describe the design. Put no payloads, literals, secrets or private-first detail in it: IDs and status only for private items.

## Assets

- <asset, for example: booking records, customer PII, webhook signing secret (never its value)>

## Actors

| Actor | Trust level | Notes |
|---|---|---|
| Anonymous | none | |
| Authenticated user (throwaway) | own data only | |
| Other user (throwaway) | other user's data | |
| Operator or admin (throwaway) | product admin | |

## Trust boundaries

- <boundary, for example: public HTTP API to the product database>

## Abuse cases

| Abuse-case ID | Description (test-design level) | Boundary crossed |
|---|---|---|
| <P5-... ID> | <what an actor tries to do> | <boundary> |

## Controls

- <control the product claims, and where it is implemented (repo, ref, file)>

## Covering rows

| Row ID | Disposition | Notes |
|---|---|---|
| <P5-... ID> | KEEP, ALIAS or gated | <scope and residual> |

## Open questions

- <question and the probe (section 13) that answers it>
