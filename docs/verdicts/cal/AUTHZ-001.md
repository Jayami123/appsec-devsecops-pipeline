# P5-CAL-AUTHZ-001

- Row ID: P5-CAL-AUTHZ-001
- Verdict: owner PASS; matrix PASS; other GET, PUT, DELETE DESIGN VERDICT (uid capability, depends on CAP-001)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: the owner reads (200), reschedules (new uid, D-CAL-B35) and cancels its own booking; the state reads cancelled. Negatives (renamed to the observed capability outcome, B50): a stranger key that is neither host nor attendee reads the booking (200), reschedules it (2xx) and cancels it (2xx); the owner's state is read first and reads accepted or cancelled as observed.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Design verdict (B50): the uid is a bearer capability. The authenticated and anonymous paths share one guard chain. Detail held by the owner. Depends on CAP-001.
