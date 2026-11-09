// Accepted-risk date and match rules (L-PIPE plan 7.4, NEW-PIPE-4).
// JSON Schema cannot compare dates; this does.
import { BUDGETS } from "./budgets.ts";

const TTL_DAYS = BUDGETS.ACCEPTED_RISK_TTL_DAYS.value;
const MS_PER_DAY = 86_400_000;

export interface AcceptedRisk {
  readonly id: string;
  readonly acceptedOn: string;
  readonly expires: string;
  readonly match: { readonly tool: string; readonly fingerprint: string };
}

// Returns the UTC day number for a YYYY-MM-DD date, or null when it is not a real calendar date.
function dayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return ms / MS_PER_DAY;
}

export function validateAcceptedRisks(entries: readonly AcceptedRisk[]): string[] {
  const errors: string[] = [];
  for (const entry of entries) {
    const accepted = dayNumber(entry.acceptedOn);
    const expires = dayNumber(entry.expires);
    if (accepted === null) {
      errors.push(`ACCEPTED_RISK_INVALID: ${entry.id} acceptedOn is not a real YYYY-MM-DD date`);
      continue;
    }
    if (expires === null) {
      errors.push(`ACCEPTED_RISK_INVALID: ${entry.id} expires is not a real YYYY-MM-DD date`);
      continue;
    }
    if (expires <= accepted) {
      errors.push(`ACCEPTED_RISK_INVALID: ${entry.id} expires is not after acceptedOn`);
    } else if (expires - accepted > TTL_DAYS) {
      errors.push(`ACCEPTED_RISK_INVALID: ${entry.id} expires is more than ACCEPTED_RISK_TTL_DAYS after acceptedOn`);
    }
  }
  return errors;
}

// "suppressed" when a matching entry is unexpired; "expired" when matches exist and all have expired (the caller
// treats expired as NEW, a fail, MP:698); "none" when no entry matches the tool and fingerprint.
export function matchAcceptedRisk(
  entries: readonly AcceptedRisk[],
  finding: { tool: string; fingerprint: string },
  today: string,
): "suppressed" | "expired" | "none" {
  const todayDay = dayNumber(today);
  if (todayDay === null) throw new Error(`ACCEPTED_RISK_INVALID: today is not a real YYYY-MM-DD date: ${today}`);
  const matching = entries.filter(
    (entry) => entry.match.tool === finding.tool && entry.match.fingerprint === finding.fingerprint,
  );
  if (matching.length === 0) return "none";
  const unexpired = matching.some((entry) => {
    const expires = dayNumber(entry.expires);
    return expires !== null && expires >= todayDay;
  });
  return unexpired ? "suppressed" : "expired";
}
