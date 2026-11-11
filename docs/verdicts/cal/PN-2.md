# P5-CAL-PN-2

- Row ID: P5-CAL-PN-2
- Verdict: valid requests PASS; valid extras PASS after the schema-error fix (B54)
- Harness: qa-portfolio-harness v0.4.0
- Fork ref: c2b7ac44c66f24ffef1662b276f0653988a609a3
- Control and negative: Control: GET /v2/bookings and GET /v2/event-types answer 200 with a throwaway key. Negative: Schemathesis 4.33.1, --max-examples 200, --checks not_a_server_error, unauthenticated; POST /v2/bookings excluded by operationId (B54).
- Budget: FUZZ_MAX_EXAMPLES = 200; FUZZ_WALL_MIN = 10 (budgets.ts:91, :96)
- Leak-check: not applicable (no probe registered). Cancelled bookings and throwaway users are retained under the run prefix (D-CAL-B20, B33).
- Note: Schema Error root cause (B54): the request body of BookingsController_2024_08_13_createBooking is a oneOf of CreateBookingInput_2024_08_13 and CreateRecurringBookingInput_2024_08_13 that Schemathesis cannot generate (report: JUnit, reproduced offline without a server). Unauthenticated run; 53 operations exercised only as 401 or 403 (coverage limit).
