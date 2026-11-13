# P5-CAL-OAUTH-001

- Row ID: P5-CAL-OAUTH-001
- Verdict: PASS (2 of 2); gate lifted by P-5 evidence (D-CAL-B41)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: the first redemption of a PKCE code at the token route returns an access token (200). Negative: a second redemption of the same code yields no token and status >= 400.
- Budget: none
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Normal user routes only: oAuth.submitClientForReview, oAuth.generateAuthCode, /api/auth/oauth/token. The client is PENDING and owned (fork ref held by the owner, ensureClientIsApprovedOrOwnedPending). A PKCE client is public, no secret (D-CAL-B46).
