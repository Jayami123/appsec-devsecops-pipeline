// Webhook URL guard corpus (doc plan section 4.6; pure data). Create-time refusal: fork ref held by the owner in the
// Documenso fork at f4105e47 (fork ref held by the owner). Each entry is a literal the
// guard must refuse. The public control is RFC 2606 reserved and is used at create time only; it is never
// delivered to (delivery is gated on the owner canary, PN-1).

export type GuardClass = "loopback" | "private" | "link-local" | "ipv6" | "unspecified";

export interface GuardCorpusEntry {
  readonly id: string;
  readonly url: string;
  readonly class: GuardClass;
}

const PATH = "/p5-hook";

const HOSTS: readonly { id: string; host: string; class: GuardClass }[] = [
  { id: "localhost", host: "localhost", class: "loopback" },
  { id: "loopback-dotted", host: "127.0.0.1", class: "loopback" },
  { id: "loopback-decimal", host: "2130706433", class: "loopback" },
  { id: "loopback-hex", host: "0x7f000001", class: "loopback" },
  { id: "unspecified", host: "0.0.0.0", class: "unspecified" },
  { id: "private-10", host: "10.0.0.1", class: "private" },
  { id: "private-192", host: "192.168.1.1", class: "private" },
  { id: "link-local-metadata", host: "169.254.169.254", class: "link-local" },
  { id: "private-172", host: "172.16.0.1", class: "private" },
  { id: "ipv6-loopback", host: "[::1]", class: "ipv6" },
  { id: "ipv6-mapped-loopback", host: "[::ffff:127.0.0.1]", class: "ipv6" },
  { id: "ipv6-unique-local", host: "[fd00::1]", class: "ipv6" },
  { id: "ipv6-link-local", host: "[fe80::1]", class: "link-local" },
];

/** Every entry the create-time guard must refuse. url = `http://<host>/p5-hook`. */
export const URL_GUARD_CORPUS: readonly GuardCorpusEntry[] = HOSTS.map(
  ({ id, host, class: cls }) => ({
    id,
    url: `http://${host}${PATH}`,
    class: cls,
  }),
);

/** Allowed control. RFC 2606 reserved name; create-time only, never delivered (PN-1 delivery is gated). */
export const PUBLIC_CONTROL_URL = "https://example.com/p5-hook";
