import { randomBytes } from "node:crypto";
import { networkGateway } from "../../kit/webhooks/docker-net.ts";
import { startReceiver, type Receiver } from "../../kit/webhooks/receiver.ts";

/** Per-run path nonce for the SSRF canary. Held in memory only. Never written to an artefact or a log. */
export function newCanaryNonce(): string {
  return randomBytes(16).toString("hex");
}

/** The canary URL the workflow step calls. The receiver is the kit receiver on the runner host. */
export function canaryUrl(port: number, nonce: string): string {
  // host.docker.internal resolves to the docker bridge gateway through the harness extra_hosts
  // host-gateway entry (docker/twenty.compose.yml:16-17, :40-41).
  return `http://host.docker.internal:${port}/${nonce}`;
}

/**
 * Starts the kit receiver bound on loopback and on the docker bridge gateway (D-TW-B6). No container
 * exec is used: the bridge gateway comes from a read-only `docker network inspect bridge`.
 */
export async function startCanaryReceiver(): Promise<{
  readonly receiver: Receiver;
  readonly port: number;
  readonly stop: () => Promise<void>;
}> {
  const gateway = await networkGateway("bridge");
  const receiver = await startReceiver({ hosts: ["127.0.0.1", gateway], port: 0 });
  return { receiver, port: receiver.port, stop: () => receiver.stop() };
}
