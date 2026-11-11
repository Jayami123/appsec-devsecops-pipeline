# P5-CAL-NEW-CAL-2

- Row ID: P5-CAL-NEW-CAL-2
- Verdict: PASS (2 of 2)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: the first cancel succeeds and the state reads cancelled. Negative: a second cancel of the same uid is refused (>= 400) and the state stays cancelled.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: bookings.controller.ts:336.
