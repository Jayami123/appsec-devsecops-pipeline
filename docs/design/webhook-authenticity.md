# Webhook authenticity (MI-11): design note and documentation verdict

Status: documentation verdict, for the owner to review. This note describes the signing and verification code in the closeout kit. It contains no secret, no test body and no private detail. A mismatch here is a documentation finding, not a product result.

## What the kit does

The kit is vendored under `src/kit/webhooks/`. Two files carry the logic:

- `sign.ts` builds the exact bytes and headers a sender uses. Each signer returns the body it signed together with the headers, so a test cannot sign one byte sequence and send another.
- `verify.ts` computes what a correct receiver computes, compares it in constant time, and returns a fixed failure reason. The failure reasons are `missing-header`, `malformed-header`, `malformed-body`, `signature-mismatch` and `stale-timestamp`.

## Schemes the kit covers

| Scheme | How it signs | Freshness | Notes |
|---|---|---|---|
| Cal outgoing | HMAC-SHA256 in hex over the raw body. Without a secret, the product sends a fixed literal. | None. The product sends no timestamp. | The verifier compares the literal in the no-secret case. |
| Documenso outgoing | The configured secret is sent in a header as-is. | None. | No HMAC and no timestamp. This is a shared-secret header, not a signature. |
| Twenty outgoing | HMAC-SHA256 in hex over the timestamp, a colon, then the raw body. A nonce is sent but is not signed. | Opt-in. The caller passes a tolerance, or `null` for none. | The product documents no tolerance, so the tolerance is a receiver policy. |
| Cal inbound (Daily) | HMAC-SHA256 keyed with the base64-decoded secret over the timestamp, a dot, then the re-serialised JSON body. The digest is base64. | Opt-in, in seconds. | Signing has a `raw` and a `reserialised` mode. Only `reserialised` matches the product's own recomputation for arbitrary whitespace. |
| Stripe (payment events) | The official SDK builds and checks the header. | The SDK's default tolerance, passed in by the caller. | Never re-implemented in the kit, so construction cannot drift from the SDK. |

## How verification works

1. The header is looked up case-insensitively. A repeated header counts as missing, because it is ambiguous.
2. The expected value is computed over the raw bytes, not over a parsed object, except for the Daily scheme that the product itself re-serialises.
3. The comparison is constant time (`timingSafeEqual` on equal-length buffers).
4. Freshness is checked only when the caller supplies a tolerance. For the Twenty and Daily schemes, a receiver that passes `null` accepts any age once the signature matches.

## Documentation verdict (for owner review)

1. The verifiers match each scheme as the kit describes it, and the comparison is constant time. Verdict: PASS as a description.
2. Freshness is a receiver policy, not a property the product guarantees. Where the product sends no timestamp (Cal outgoing, Documenso), there is no freshness check to make. Where the product sends a timestamp, the kit only checks it when the caller sets a tolerance. Verdict: recorded. A caller that passes no tolerance must not describe the receiver as stale-safe.
3. The Documenso scheme is a shared-secret header, not an HMAC. It offers no replay protection by construction. Verdict: recorded design property. It is not counted as a finding, because the product sends no signature to verify.
4. The replay and stale-timestamp behaviour of the products is tested against the product, not asserted by the kit. Those results are in the ledger as P5-CAL-WH-002 and P5-CAL-WH-003, with their current statuses. This note does not restate them.
5. The Stripe path cannot drift, because it uses the SDK's own construction and verification. Verdict: PASS.

## What this note does not cover

- The secret values, and how they are provisioned. Those are harness-owned and never written in this repository.
- The test bodies in `tests/unit/webhooks/`.
- Any product's internal handling after a signature is accepted.
