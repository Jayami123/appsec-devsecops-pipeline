import { randomBytes } from "node:crypto";
import { BUDGETS } from "../../security/budgets.ts";
import { signDaily, type DailySigningMode } from "../../kit/webhooks/sign.ts";

// apps/web/app/api/recorded-daily-video/route.ts at c2b7ac44 (route read in STEP 3, see the verdict records).
export const DAILY_ROUTE = "/api/recorded-daily-video";

/** Unix seconds WEBHOOK_STALE_AGE_S + 1 before `nowSeconds`. */
export function staleTimestamp(nowSeconds: number): string {
  return String(nowSeconds - (BUDGETS.WEBHOOK_STALE_AGE_S.value + 1));
}

export function dailyDelivery(
  secretBase64: string,
  payload: unknown,
  timestamp: string,
  mode: DailySigningMode = "raw",
) {
  return signDaily({ secretBase64, body: Buffer.from(JSON.stringify(payload)), timestamp, mode });
}

/** A signature that is not derived from the secret: 32 random bytes, base64. */
export function forgedSignature(): string {
  return randomBytes(32).toString("base64");
}
