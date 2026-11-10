import { randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { apiBaseUrl } from "../../kit/env.ts";
import type { AdminSession } from "./admin-session.ts";

/** A throwaway customer created under the run prefix. `password` and `token` are never printed. */
export interface ThrowawayCustomer {
  readonly label: string;
  readonly email: string;
  readonly password: string;
  readonly token: string;
  readonly customerId: string;
}

/** Pure: `<prefix>-<label>@example.test`. The .test TLD is reserved (RFC 2606); no real domain is contacted. */
export function throwawayCustomerEmail(prefix: string, label: string): string {
  return `${prefix}-${label}@example.test`;
}

/** Refuses any email that is not a throwaway under the run prefix. The email value is never echoed. */
export function assertThrowawayEmail(email: string, prefix: string): void {
  if (!email.startsWith(`${prefix}-`) || !email.endsWith("@example.test")) {
    throw new Error("NOT_THROWAWAY: email is outside the run prefix or the reserved test domain");
  }
}

function generatedPassword(): string {
  return randomBytes(18).toString("base64url");
}

async function emailPassword(
  api: APIRequestContext,
  path: "register" | "login",
  email: string,
  password: string,
  publishableKey: string,
): Promise<string> {
  const route =
    path === "register" ? "/auth/customer/emailpass/register" : "/auth/customer/emailpass";
  const response = await api.fetch(`${apiBaseUrl("medusa")}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-publishable-api-key": publishableKey },
    data: { email, password },
  });
  if (response.status() !== 200)
    throw new Error(`customer ${path} failed: HTTP ${response.status()}`);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error(`customer ${path}: no token in response`);
  return body.token;
}

/**
 * Creates a throwaway customer: register (token), create the customer profile with that token
 * (POST /store/customers), then log in for the actor token. Routes: auth emailpass register/login and
 * store customers (lane probes; P-10).
 */
export async function createThrowawayCustomer(
  api: APIRequestContext,
  input: { runPrefix: string; label: string; publishableKey: string },
): Promise<ThrowawayCustomer> {
  const email = throwawayCustomerEmail(input.runPrefix, input.label);
  assertThrowawayEmail(email, input.runPrefix);
  const password = generatedPassword();
  const registrationToken = await emailPassword(
    api,
    "register",
    email,
    password,
    input.publishableKey,
  );
  const created = await api.fetch(`${apiBaseUrl("medusa")}/store/customers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": input.publishableKey,
      authorization: `Bearer ${registrationToken}`,
    },
    data: { email, first_name: "P5", last_name: input.label },
  });
  if (created.status() !== 200) throw new Error(`create customer failed: HTTP ${created.status()}`);
  const customer = ((await created.json()) as { customer?: { id?: string } }).customer;
  if (!customer?.id) throw new Error("create customer: no customer id in response");
  const token = await emailPassword(api, "login", email, password, input.publishableKey);
  return { label: input.label, email, password, token, customerId: customer.id };
}

export async function loginThrowawayCustomer(
  api: APIRequestContext,
  input: { email: string; password: string; publishableKey: string },
): Promise<{ token: string }> {
  const token = await emailPassword(
    api,
    "login",
    input.email,
    input.password,
    input.publishableKey,
  );
  return { token };
}

/** DELETE /admin/customers/:id (core dist/api/admin/customers/[id]/route.js). Throwaway customers only. */
export async function deleteThrowawayCustomer(
  api: APIRequestContext,
  admin: AdminSession,
  customerId: string,
): Promise<void> {
  const response = await api.fetch(`${apiBaseUrl("medusa")}/admin/customers/${customerId}`, {
    method: "DELETE",
    headers: { authorization: admin.authorization },
  });
  if (response.status() !== 200)
    throw new Error(`delete customer failed: HTTP ${response.status()}`);
}
