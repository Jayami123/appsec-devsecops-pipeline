# P5-CAL-AUTHZ-001

- Row ID: P5-CAL-AUTHZ-001
- Verdict: owner PASS; matrix PASS; other GET, PUT, DELETE PRODUCT BUG (SUSPECTED)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: the owner reads (200), reschedules (new uid, D-CAL-B35) and cancels its own booking; the state reads cancelled. Negatives: a stranger key (neither host nor attendee; the attendee is a non-user address, D-CAL-B32) reads the booking (200), reschedules it (201) and cancels it (200). The owner's state reads cancelled afterwards.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Owner state is read before each refusal assertion. Verb mapping PUT = reschedule, DELETE = cancel (D-CAL-B29). The matrix is a declared constant (D-CAL-B39).
