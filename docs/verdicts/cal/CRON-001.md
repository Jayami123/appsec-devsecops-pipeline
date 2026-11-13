# P5-CAL-CRON-001 (+ MI-9)

- Row ID: P5-CAL-CRON-001 (+ MI-9)
- Verdict type: PASS (14 of 14 titles, cal-serial live run)
- Harness: qa-portfolio-harness v0.4.0 (pin, fork ref held by the owner)
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control: "accepts the key" per route (raw key in authorization header; plus Bearer CRON_SECRET on the three routes that accept it)
- Negative: "refuses a missing key" per route, including a wrong key and an empty credential (MI-9)
- Before/after: none (no state is created)
- Budget: none
- Cleanup: none needed (no resource created)
- Leak-check: not applicable (no probe registered)
- Gate and blocker: not gated
- Result by title (cal-serial, `up` exit 0, `down` exit 0): all 14 passed
- Evidence: status codes are 401 or 403 on refusal.
- Secrets: per-job keys generated in the run environment, masked in CI, never printed (D-CAL-B5)
- Run id: p5-qa-<timestamp>-<8 hex>, shape checked; not recorded here
