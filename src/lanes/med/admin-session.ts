import { getAdapter } from "qa-portfolio-harness";

export interface AdminSession {
  /** "Bearer <jwt>"; never printed. */
  readonly authorization: string;
}

/**
 * Admin session from the harness authenticate() (the harness reads the admin credentials; this module never does).
 * The harness returns AuthSession.authorizationHeader fork ref held by the owner).
 */
export async function openHarnessAdminSession(): Promise<AdminSession> {
  const session = await getAdapter("medusa").authenticate();
  return { authorization: session.authorizationHeader };
}
