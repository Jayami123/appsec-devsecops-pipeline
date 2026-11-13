# P5-CAL-AUTHZ-002

- Row ID: P5-CAL-AUTHZ-002
- Verdict: keyed PASS; anonymous POST, PATCH, DELETE DESIGN VERDICT (booker flow and uid capability, depends on CAP-001)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: keyed reschedule, create (201) and cancel succeed. Anonymous cells assert the observed capability outcome: anonymous create 201 (booker flow); anonymous reschedule and cancel by uid succeed, state read first.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Design verdicts (B34, B36, B50): fork ref held by the owner, :296-297, :336-337 share OptionalApiAuthGuard and BookingUidGuard; the create gate applies only to event types requiring authentication (fork ref held by the owner). Depends on CAP-001.
