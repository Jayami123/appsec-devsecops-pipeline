# P5-CAL-NEW-CAL-4

- Row ID: P5-CAL-NEW-CAL-4
- Verdict: own PASS; cross-key read by uid DESIGN VERDICT (uid capability, depends on CAP-001)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: key A reads A's booking (200). Negative (renamed, B50): key A reads B's booking by uid and gets 200; B's state is read first and reads accepted.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Design verdict (B50): GET by uid shares the capability guard chain with AUTHZ-001 (bookings.controller.ts:190-191; booking-uid.guard.ts:8-14). Depends on CAP-001.
