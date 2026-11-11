# P5-CAL-NEW-CAL-3

- Row ID: P5-CAL-NEW-CAL-3
- Verdict: PASS (2 of 2)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: a single booking for a slot succeeds (201). Negative: two parallel bookings for one slot (Promise.all); exactly one returns 201.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Two non-user attendees; a separate slot per test.
