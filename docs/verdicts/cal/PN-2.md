# P5-CAL-PN-2

- Row ID: P5-CAL-PN-2
- Verdict: valid requests PASS; valid extras RED (TEST BUG SUSPECTED, root cause open)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: GET /v2/bookings and GET /v2/event-types answer 200 with a throwaway key (PASS). Negative: Schemathesis 4.33.1, --max-examples 200, --checks not_a_server_error, unauthenticated (D-CAL-B40): 33,024 generated, 33,024 passed, no 5xx. The process exited 1 on one Schema Error whose operation is not in the captured output.
- Budget: FUZZ_MAX_EXAMPLES = 200; FUZZ_WALL_MIN = 10 (budgets.ts:91, :96)
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Scratch working directory; no credential in argv or on disk. 53 operations returned only 401/403 (coverage limit, UNVERIFIED).
