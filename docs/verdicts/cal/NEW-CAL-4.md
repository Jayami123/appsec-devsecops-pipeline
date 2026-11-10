# P5-CAL-NEW-CAL-4

- Row ID: P5-CAL-NEW-CAL-4
- Verdict: own PASS; cross-key PRODUCT BUG (SUSPECTED)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: key A reads A's booking (200). Negative: key A reads B's booking and gets 200 (expected 401, 403 or 404). B's state reads accepted before the assertion.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Same finding class as AUTHZ-001 GET: an authenticated non-participant reads a booking by uid.
