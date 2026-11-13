// Login transport check (F-ZAP-1). A real browser fills a product's login form with a random, throwaway password and
// submits it. It records how the browser sends the password: in the URL or in a request body. It needs no account,
// because only the transport is observed. It prints booleans, methods and form attributes. It never prints the
// dummy password, a cookie, or a request body.
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/**
 * @param {string} base  loopback origin, e.g. http://127.0.0.1:3000
 * @param {string[]} paths candidate login paths, tried in order
 * @returns {Promise<{ ok: boolean, path?: string, formMethodAttr?: string, passwordInUrl?: boolean, passwordInBody?: boolean, requests?: number, reason?: string }>}
 */
export async function checkLogin(base, paths) {
  // CI installs the browser with `npx playwright install chromium`. A local run may point PW_CHROMIUM at a
  // pre-installed binary (the brief's /opt/pw-browsers path); it is unset in CI.
  const executablePath = process.env["PW_CHROMIUM"];
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const path of paths) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(new URL(path, base).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        const form = page.locator("form:has(input[type=password])").first();
        if ((await form.count()) === 0) continue;
        const formMethodAttr = (
          (await form.getAttribute("method")) ?? "(none, GET by default)"
        ).toLowerCase();
        const dummy = randomBytes(18).toString("base64url");
        const email = `probe-${randomBytes(4).toString("hex")}@example.test`;
        const seen = [];
        page.on("request", (request) => {
          const body = request.postData() ?? "";
          if (request.method() !== "GET" || request.url().includes(dummy) || body.includes(dummy)) {
            seen.push({ url: request.url(), method: request.method(), body });
          }
        });
        const emailField = form
          .locator("input[type=email], input[name*=email i], input[type=text]")
          .first();
        if ((await emailField.count()) > 0) await emailField.fill(email);
        await form.locator("input[type=password]").first().fill(dummy);
        await form
          .locator("button[type=submit], input[type=submit], button")
          .first()
          .click({ timeout: 10000 });
        await page.waitForTimeout(3000);
        const passwordInUrl = seen.some(
          (r) => r.url.includes(dummy) || r.url.includes(encodeURIComponent(dummy)),
        );
        const passwordInBody = seen.some((r) => r.body.includes(dummy));
        return {
          ok: true,
          path,
          formMethodAttr,
          passwordInUrl,
          passwordInBody,
          requests: seen.length,
        };
      } finally {
        await context.close();
      }
    }
    return { ok: false, reason: "no login form with a password input on any candidate path" };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, paths] = process.argv.slice(2);
  if (!base || !paths) {
    console.error("usage: login-transport-check.mjs <origin> <path[,path...]>");
    process.exit(2);
  }
  try {
    const result = await checkLogin(base, paths.split(","));
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(
      `login-transport-check: tool error (${error instanceof Error ? error.name : "error"})`,
    );
    process.exit(2);
  }
}
