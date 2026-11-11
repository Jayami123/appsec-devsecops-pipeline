// P5-MED-AUTHZ-001 (med plan 3c.1, reframed). A guest cart is claimed by its owner; a second customer must not move it.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { createThrowawayCustomer, deleteThrowawayCustomer } from "../../../src/lanes/med/auth.ts";
import {
  claimCart,
  createGuestCart,
  openRunStore,
  readCartCustomerId,
} from "../../../src/lanes/med/setup.ts";

test.describe("P5-MED-AUTHZ-001", () => {
  test("P5-MED-AUTHZ-001 control: a guest cart claimed by its owner moves from no customer to that customer", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const a = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "authz1a",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, a.customerId));

    const cartId = await createGuestCart(request, store);
    expect(
      await readCartCustomerId(request, store, cartId),
      "before the claim: a guest cart has no customer",
    ).toBeNull();

    const status = await claimCart(request, store, cartId, a.token);
    expect(status, "owner claim status").toBe(200);
    expect(await readCartCustomerId(request, store, cartId), "after the claim: the owner").toBe(
      a.customerId,
    );
  });

  test("P5-MED-AUTHZ-001 a second customer cannot move a claimed cart to itself", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const a = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "authz1a",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, a.customerId));
    const b = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "authz1b",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, b.customerId));

    // Independent fixture C2: the owner A claims it in setup (state before the negative check).
    const cartId = await createGuestCart(request, store);
    expect(await claimCart(request, store, cartId, a.token), "setup: owner claim").toBe(200);
    const before = await readCartCustomerId(request, store, cartId);
    expect(before, "before: owner A").toBe(a.customerId);

    const attemptStatus = await claimCart(request, store, cartId, b.token);
    const after = await readCartCustomerId(request, store, cartId);

    if (attemptStatus === 200) {
      // The owner-first control above proves the claim route works; a 200 here is the suspected defect.
      // Owner decision (B30): the defect is an expected failure in this branch only. The assertion below is unchanged.
      expectedDefect(
        "P5-MED-AUTHZ-001: POST /store/carts/:id/customer returns 200 to a second customer and the cart moves to that customer; " +
          "dist/api/store/carts/[id]/customer/route.js:12 passes the caller's actor id to transferCartCustomerWorkflowId and " +
          "dist/cart/workflows/transfer-cart-customer.js:70 skips only when the caller is already the customer, with no owner check; " +
          "live status 200 on five runs (p5-run-authz2, p5-run-med1, p5-run-med3, p5-run-med4, p5-run-med5)",
      );
      expect(after, "PRODUCT BUG (SUSPECTED): customer B moved a cart claimed by customer A").toBe(
        a.customerId,
      );
    } else {
      expect(attemptStatus, "second claim refused with a client error").toBeGreaterThanOrEqual(400);
      expect(after, "cart still owned by A after the refused claim").toBe(a.customerId);
    }
  });
});
