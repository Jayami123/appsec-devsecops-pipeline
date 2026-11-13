# P5-TW-MT-001

| Field | Value |
|---|---|
| ID | P5-TW-MT-001 |
| Verdict | PASS |
| Job | p5-tw / tw-multiws (`--grep "@multiws"`) |
| Run | 43409729454 (commit 8c1042a) |
| File | `tests/integration/tw/apple-cannot-read-yc.spec.ts` |
| Control | A's member reads its own company on the YC origin: 200, same id |
| Negative | B's member (Apple) on the YC origin: refused (4xx); no company value in the body |
| Budget | none |
| Harness | qa-portfolio-harness v0.5.0; Twenty v2.44.0 (pin 7cbdfec6) |
| Status | PASS on the seeded YC and Apple workspaces (D-TW-B50) |
