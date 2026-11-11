// Non-secret fixture data for the med lane. No credential is defined here.

/** Origin the harness store CORS default allows (STORE_CORS; see the CORS source note in the build log). */
export const ALLOWED_ORIGIN = "http://localhost:8000";

/** An origin the store does not allow. Reserved .test host, so it never resolves to a real site. */
export const DISALLOWED_ORIGIN = "https://p5-disallowed.example.test";

/** Owner decision D-MED-8 (med plan 3c.5): PII fields that must not appear on an unauthenticated route. */
export const PII_FIELDS: readonly string[] = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "billing_address.*",
  "shipping_address.*",
  "customer.*",
];
