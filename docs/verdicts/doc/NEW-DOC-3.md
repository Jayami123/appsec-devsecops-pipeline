# NEW-DOC-3: upload abuse (serial)

| Verdict type | PASS on control and oversized; PRODUCT BUG (confirmed) on text-as-PDF and polyglot |
| Test file | tests/serial/doc/upload-abuse.spec.ts |
| Control | one valid minimal PDF accepted (200) |
| Negatives | text labelled as PDF; oversized (DOC_UPLOAD_OVERSIZE_BYTES); polyglot. Each must be 4xx; a 5xx or an acceptance is a finding |
| Count | uploads = 1 + DOC_UPLOAD_CASES, below docRouteLimit upload; formula in the budget module) |
| Budget | DOC_UPLOAD_CASES 3; DOC_UPLOAD_OVERSIZE_BYTES 52428801; DOC_ROUTE_LIMITS upload 20 |
| expectedDefect | P5-DOC-NEW-DOC-3 (D-DOC-B60): detail held by the owner |
| Cleanup | none beyond the run prefix; the upload has no product delete route in the lane (retained under the run prefix; the CI stack is ephemeral) |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` |
| Harness | `qa-portfolio-harness` v0.4.0 (at the time of this run) |
| Live status (this PR) | CI run 42979416596: control 200; oversized 4xx; text-as-PDF and polyglot 500 |
| Live run ID | 42979416596 |
