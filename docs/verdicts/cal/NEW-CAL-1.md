# P5-CAL-NEW-CAL-1

- Row ID: P5-CAL-NEW-CAL-1
- Verdict: PASS (2 of 2)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: the owner reads its booking references (200). Negative: a second user declines the owner's booking (refused); the owner's state reads accepted.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Sub-resource routes: fork ref held by the owner (references), :494 (decline).
