import { getAdapter } from "qa-portfolio-harness";

export interface AdminSession {
  /** "Bearer <jwt>"; never printed. */
  readonly authorization: string;
}

/**
 * Admin session from the harness authenticate() (the harness reads the admin credentials; this module never does).
 * The harness returns AuthSession.authorizationHeader (node_modules/qa-portfolio-harness/src/types.ts:7).
 */
export async function openHarnessAdminSession(): Promise<AdminSession> {
  const session = await getAdapter("medusa").authenticate();
  return { authorization: session.authorizationHeader };
}
