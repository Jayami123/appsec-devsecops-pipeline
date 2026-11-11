// P5-TW-2FA-001 / MI-14 (tw-serial; TEST). A throwaway member enrols TOTP through the product routes
// (initiateOTPProvisioningForAuthenticatedUser and verifyTwoFactorAuthenticationMethodForAuthenticatedUser,
// two-factor-authentication resolver lines 105-107 and 178). Control: a valid code for the previous step is
// accepted by getAuthTokensFromOTP on a fresh login token (the current step was used by the enrolment).
// Negative: TOTP_BURST wrong codes, each outside the +-1 step window, each on a fresh login token. Oracle:
// each wrong code is refused; a limit at or before the budget is limit evidence, and its absence is a
// deployment finding that fails the row.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import {
  adminSetupSession,
  throwawayEmail,
  throwawayPassword,
} from "../../../src/lanes/tw/login.ts";
import { awaitInviteLink, joinWorkspace } from "../../../src/lanes/tw/member.ts";
import { gql } from "../../../src/lanes/tw/gql.ts";
import { decodeBase32, totpAt, TOTP_STEP_S } from "../../../src/lanes/tw/totp.ts";
import { runBurst } from "../../../src/security/burst.ts";

async function loginWithOtp(input: {
  baseUrl: string;
  email: string;
  password: string;
  otp: string;
}): Promise<{ ok: boolean; limited: boolean; status: number }> {
  const first = await gql<{ getLoginTokenFromCredentials: { loginToken: { token: string } } }>({
    baseUrl: input.baseUrl,
    endpoint: "metadata",
    operation: "getLoginTokenFromCredentials",
    query: `mutation L($email: String!, $password: String!, $origin: String!) {
      getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) { loginToken { token } }
    }`,
    variables: {
      email: input.email,
      password: input.password,
      origin: new URL(input.baseUrl).origin,
    },
  });
  const response = await fetch(`${input.baseUrl}/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `mutation O($otp: String!, $loginToken: String!, $origin: String!) {
        getAuthTokensFromOTP(otp: $otp, loginToken: $loginToken, origin: $origin) { tokens { accessOrWorkspaceAgnosticToken { token } } }
      }`,
      variables: {
        otp: input.otp,
        loginToken: first.getLoginTokenFromCredentials.loginToken.token,
        origin: new URL(input.baseUrl).origin,
      },
    }),
  });
  const text = await response.text();
  const limited =
    response.status === 429 || /too many|rate limit|locked|throttl|blocked/i.test(text);
  return { ok: response.ok && !text.includes('"errors"'), limited, status: response.status };
}

test("P5-TW-2FA-001: a burst of wrong one-time codes is limited or recorded", async ({
  run,
}, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const email = throwawayEmail(run.prefix, "mfa");
  const password = throwawayPassword();
  const member = await joinWorkspace({
    baseUrl: base,
    admin,
    email,
    password,
    awaitLink: () => awaitInviteLink(email),
  });
  const provisioning = await gql<{ initiateOTPProvisioningForAuthenticatedUser: { uri: string } }>({
    baseUrl: base,
    endpoint: "metadata",
    bearer: member.accessToken,
    operation: "initiateOTPProvisioningForAuthenticatedUser",
    query: `mutation { initiateOTPProvisioningForAuthenticatedUser { uri } }`,
  });
  const secret = decodeBase32(
    new URL(provisioning.initiateOTPProvisioningForAuthenticatedUser.uri).searchParams.get(
      "secret",
    ) ?? "",
  );
  const now = Math.floor(Date.now() / 1000);
  const enrolled = await gql<{
    verifyTwoFactorAuthenticationMethodForAuthenticatedUser: { success: boolean };
  }>({
    baseUrl: base,
    endpoint: "metadata",
    bearer: member.accessToken,
    operation: "verifyTwoFactorAuthenticationMethodForAuthenticatedUser",
    query: `mutation V($otp: String!) { verifyTwoFactorAuthenticationMethodForAuthenticatedUser(otp: $otp) { success } }`,
    variables: { otp: totpAt(secret, now) },
  });
  expect(
    enrolled.verifyTwoFactorAuthenticationMethodForAuthenticatedUser.success,
    "setup: enrolment verified",
  ).toBe(true);

  // Control: the previous step's code (not used by the enrolment) is accepted on a fresh login token.
  const control = await loginWithOtp({
    baseUrl: base,
    email,
    password,
    otp: totpAt(secret, now - TOTP_STEP_S),
  });
  expect(control.ok, "control: a valid code is accepted on a fresh login token").toBe(true);

  // Wrong codes: each is outside the +-1 step window around the current time (a fixed set of three steps).
  const valid = new Set([now - TOTP_STEP_S, now, now + TOTP_STEP_S].map((t) => totpAt(secret, t)));
  const wrongCodes: string[] = [];
  for (let guess = 0; wrongCodes.length < 20 && guess < 1_000_000; guess += 1) {
    const code = String(guess).padStart(6, "0");
    if (!valid.has(code)) wrongCodes.push(code);
  }
  // A refused OTP is HTTP 200 with a GraphQL error (live), so the outcome is classified from the
  // reply's ok and limited fields, never from the HTTP status alone.
  const outcomes: Array<"accepted" | "limited" | "refused"> = [];
  const burst = await runBurst({
    budget: "TOTP_BURST",
    attempt: async (index) => {
      const reply = await loginWithOtp({
        baseUrl: base,
        email,
        password,
        otp: wrongCodes[index] ?? "",
      });
      outcomes.push(reply.ok ? "accepted" : reply.limited ? "limited" : "refused");
      return reply.status;
    },
  });
  testInfo.annotations.push({
    type: "burst",
    description: `attempts=${burst.attempts} outcomes=${[...new Set(outcomes)].join(",")} http=${[...new Set(burst.statuses)].join(",")}`,
  });
  expect(outcomes.includes("accepted"), "no wrong code is accepted").toBe(false);
  // Deployment finding (owner decision 2; med RL-001 pattern): the verdict is an annotation and the test passes.
  const limited = outcomes.includes("limited");
  testInfo.annotations.push({
    type: limited ? "pass" : "deployment-finding",
    description: limited
      ? "limit observed within TOTP_BURST"
      : "no limit within TOTP_BURST (deployment finding, not proof of no lockout)",
  });
});
