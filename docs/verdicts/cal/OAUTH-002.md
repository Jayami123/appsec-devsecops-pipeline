# P5-CAL-OAUTH-002

- Row ID: P5-CAL-OAUTH-002
- Verdict: PASS (2 of 2); gate lifted by P-5 evidence (D-CAL-B41)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: the right code_verifier redeems the code (200 with a token). Negative: a fresh code redeemed with a wrong verifier yields no token and status >= 400.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Same route set as OAUTH-001.
