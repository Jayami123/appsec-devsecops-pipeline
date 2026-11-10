# P5-CAL-AUTHZ-002

- Row ID: P5-CAL-AUTHZ-002
- Verdict: keyed PASS; anonymous create, reschedule and cancel DESIGN VERDICT
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: keyed reschedule, create (201) and cancel succeed. Negatives: an anonymous create returns 201 (the public booker flow); an anonymous reschedule and an anonymous cancel by uid succeed and the state reads cancelled.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Design verdict, not a pass: the booking uid acts as a bearer capability for the attendee's own links (D-CAL-B34, D-CAL-B36). Authenticated non-participants are a separate PRODUCT BUG (SUSPECTED) (AUTHZ-001).
