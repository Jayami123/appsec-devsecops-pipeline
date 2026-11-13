# Guest cart and UID capability (MI-5)

Status: verdict document (master plan MI-5, MP:222). Owner lane: L-MED. L-CAL CAP-001 cites this file (cal plan `docs/plans/2026-11-10-p5-cal.md`, section 4.3 and 5.5).

Verdict for every row below: **design verdict; no defect assumed (MP:144).** A route that answers an anonymous caller with an ID-addressed record is a design choice of the product. A defect is claimed only by a live row with a control, and the AUTHZ-001 cart-claim finding is recorded separately (not in this file).

## Source and pin

| Item | Value |
|---|---|
| Medusa fork (starter) | `Jayami123/medusa-dtc-starter` at `f677db438f27294fc50e4c7c6612e71ff38eeff5` (`scripts/bootstrap.sh:15`) |
| Route handlers | Not in the fork tree (the fork has only `fork ref held by the owner` and `fork ref held by the owner`). The handlers ship in the installed core package `@medusajs/medusa@2.21.2` (lockfile of the pinned fork). Paths below are `node_modules/.pnpm/@medusajs+medusa@2.21.2_3c518c990e8263c44237d3ad70c868d4/node_modules/@medusajs/medusa/dist/api/...` and are shortened to `dist/api/...`. |
| Auth middleware | `fork ref held by the owner` (matchers at lines 47-137). Only `POST /store/carts/:id/customer` (line 75) wraps `authenticate("customer", ["session", "bearer"])`. |
| Recorded `file:line` | Matcher line numbers are from `fork ref held by the owner` at 2.21.2. Recorded as a deviation from the plan's "fork file:line" wording (D-MED-B18). |

## Routes reachable with no customer authentication

Each row is ID-addressed: the caller must know the cart or order ID. The "Caller must know" column is the capability the verdict rests on.

| Route | Method | Handler (dist) | Caller must know | Response field set | Verdict |
|---|---|---|---|---|---|
| `/store/carts/:id` | GET | `fork ref held by the owner` (matcher `fork ref held by the owner`) | cart ID | default cart field set (listed below) | design verdict; no defect assumed |
| `/store/carts/:id/line-items` | POST | `fork ref held by the owner` (`fork ref held by the owner`) | cart ID | refetched cart, default fields | design verdict; no defect assumed |
| `/store/carts/:id/line-items/:line_id` | POST, DELETE | `fork ref held by the owner` (`fork ref held by the owner`, `:97`) | cart ID and line ID | refetched cart | design verdict; no defect assumed |
| `/store/carts/:id/promotions` | POST, DELETE | `fork ref held by the owner` (`fork ref held by the owner`, `:128`) | cart ID | refetched cart | design verdict; no defect assumed |
| `/store/carts/:id/taxes` | POST | `fork ref held by the owner` (`fork ref held by the owner`) | cart ID | refetched cart | design verdict; no defect assumed |
| `/store/carts/:id/shipping-methods` | POST | `fork ref held by the owner` (`fork ref held by the owner`) | cart ID | refetched cart | design verdict; no defect assumed |
| `/store/carts/:id/complete` | POST | `fork ref held by the owner` (`fork ref held by the owner`) | cart ID | order (or cart on failure) | design verdict; no defect assumed. The lock on complete is tested by NEW-MED-2 (live). |
| `/store/orders/:id` | GET | `fork ref held by the owner` | order ID (the ID is the only check; comment at lines 5-10 says so, intentional) | `defaultStoreRetrieveOrderFields` (listed below) | design verdict (fact 13; intentional by the source comment) |

Routes that do require the customer (for contrast, not in this table): `POST /store/carts/:id/customer` (`fork ref held by the owner`), `GET /store/orders` (`fork ref held by the owner`, filters on `req.auth_context.actor_id` at line 10), and the customer address routes.

## Field allowlist for L-CAL CAP-001

L-CAL CAP-001 (`docs/plans/2026-11-10-p5-cal.md:238`) checks that an anonymous UID response's keys are a subset of the allowlist in this file. The CAP-001 response is the anonymous, ID-addressed record of this lane's guest cart and order routes. The mapping of the plan's "UID" wording to these routes is recorded as a decision (D-MED-B19) for the owner to confirm.

Allowlist (keys the anonymous `GET /store/carts/:id` response may contain, with the route's default field set):

```text
Cart, default fields (fork ref held by the owner, defaultStoreCartFields, 135 entries):
id currency_code email locale region_id created_at updated_at completed_at
total subtotal tax_total discount_total discount_subtotal discount_tax_total
original_total original_tax_total item_total item_subtotal item_tax_total item_discount_total
original_item_total original_item_subtotal original_item_tax_total
shipping_total shipping_subtotal shipping_tax_total shipping_discount_total
original_shipping_tax_total original_shipping_subtotal original_shipping_total
credit_line_subtotal credit_line_tax_total credit_line_total metadata sales_channel_id
promotions.* items.* customer.id customer.email customer.groups.id
shipping_methods.* shipping_address_id shipping_address.* billing_address_id billing_address.*
region.* *region.countries *payment_collection *payment_collection.payment_sessions *credit_lines
```

Order by ID (`GET /store/orders/:id`, `defaultStoreRetrieveOrderFields`):

```text
id status summary currency_code display_id custom_display_id region_id email
total subtotal tax_total discount_total discount_subtotal discount_tax_total
original_total original_subtotal original_tax_total item_total item_subtotal item_tax_total
original_item_total original_item_subtotal original_item_tax_total
shipping_total shipping_subtotal shipping_tax_total original_shipping_tax_total
original_shipping_subtotal original_shipping_total credit_line_total credit_line_subtotal credit_line_tax_total
created_at updated_at *credit_lines *items *items.* *shipping_address *billing_address
*shipping_methods *shipping_methods.* *payment_collections
```

Notes on the allowlist:

- A `*` prefix marks a relation expanded only on request (`*` means "optional expansion" in the core field notation); the key may be absent.
- The allowlist is the source default, not a claim about any live response. Live confirmation: **UNPROBED live** (no run id yet; see the build log in `docs/plans/2026-11-10-p5-med.md`). If a live run confirms the field set, cite its run id here.
- PII-bearing keys are in the default set (`email`, `customer.email`, `shipping_address.first_name`, `shipping_address.last_name`, `shipping_address.phone`, the billing equivalents). For an anonymous caller who knows the ID, these are disclosed. This is recorded as a design fact for the owner (D-MED-8 PII list in `src/lanes/med/fixtures.ts`). It is not a finding in this file.

## Scope limits

- Only the anonymous ID-addressed surface is listed. Authenticated routes are out of scope here.
- Verdicts here are design verdicts. The only defect claim in this lane about these routes is the AUTHZ-001 cart claim, recorded separately, and the live rows NEW-MED-2 and NEW-MED-6.
