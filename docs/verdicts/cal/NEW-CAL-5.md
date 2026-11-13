# P5-CAL-NEW-CAL-5

- Row ID: P5-CAL-NEW-CAL-5
- Verdict: PASS (3 of 3)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: an internal URL is accepted. Negatives: javascript: and protocol-relative URLs are refused (>= 400); an encoded external variant is refused (>= 400).
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: successRedirectUrl: fork ref held by the owner.
