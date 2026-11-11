// P5-MED-AUTHZ-003 (med plan 3c.3). A customer's address is scoped to that customer.
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { createThrowawayCustomer, deleteThrowawayCustomer } from "../../../src/lanes/med/auth.ts";
import { openRunStore } from "../../../src/lanes/med/setup.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";

const addressBody = (line: string) => ({
  first_name: "P5",
  last_name: "Owner",
  address_1: line,
  city: "Testville",
  country_code: "us",
  postal_code: "00000",
});

test.describe("P5-MED-AUTHZ-003", () => {
  test("P5-MED-AUTHZ-003 control: the owner updates her own address", async ({ request, run }) => {
    const store = await openRunStore(request, run);
    const a = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "authz3a",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, a.customerId));
    const base = apiBaseUrl("medusa");
    const auth = { "x-publishable-api-key": store.key.value, authorization: `Bearer ${a.token}` };

    const created = await request.fetch(`${base}/store/customers/me/addresses`, {
      method: "POST",
      headers: auth,
      data: addressBody("1 Owner Way"),
    });
    expect(created.status(), "owner creates an address").toBe(200);
    const list = (await (
      await request.fetch(`${base}/store/customers/me/addresses`, { headers: auth })
    ).json()) as {
      addresses: { id: string; address_1: string }[];
    };
    const addressId = list.addresses[0]?.id;
    expect(addressId, "address id from the owner list").toBeTruthy();

    const updated = await request.fetch(`${base}/store/customers/me/addresses/${addressId}`, {
      method: "POST",
      headers: auth,
      data: { address_1: "2 Owner Way" },
    });
    expect(updated.status(), "owner updates her address").toBe(200);
    const readBack = (await (
      await request.fetch(`${base}/store/customers/me/addresses`, { headers: auth })
    ).json()) as {
      addresses: { id: string; address_1: string }[];
    };
    expect(readBack.addresses.find((x) => x.id === addressId)?.address_1).toBe("2 Owner Way");
  });

  test("P5-MED-AUTHZ-003 another customer's address is refused with 404 and unchanged", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const a = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "authz3a",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, a.customerId));
    const b = await createThrowawayCustomer(request, {
      runPrefix: run.prefix,
      label: "authz3b",
      publishableKey: store.key.value,
    });
    run.onCleanup(() => deleteThrowawayCustomer(request, store.admin, b.customerId));
    const base = apiBaseUrl("medusa");
    const authA = { "x-publishable-api-key": store.key.value, authorization: `Bearer ${a.token}` };
    const authB = { "x-publishable-api-key": store.key.value, authorization: `Bearer ${b.token}` };

    // Independent fixture: A's address exists before B acts.
    expect(
      (
        await request.fetch(`${base}/store/customers/me/addresses`, {
          method: "POST",
          headers: authA,
          data: addressBody("9 Original Rd"),
        })
      ).status(),
    ).toBe(200);
    const listA = (await (
      await request.fetch(`${base}/store/customers/me/addresses`, { headers: authA })
    ).json()) as {
      addresses: { id: string }[];
    };
    const addressId = listA.addresses[0]?.id;
    expect(addressId, "A's address id").toBeTruthy();

    // Before: A's address line.
    const before = (await (
      await request.fetch(`${base}/store/customers/me/addresses`, { headers: authA })
    ).json()) as {
      addresses: { id: string; address_1: string }[];
    };
    expect(before.addresses[0]?.address_1, "before: A's address").toBe("9 Original Rd");

    const updateByB = await request.fetch(`${base}/store/customers/me/addresses/${addressId}`, {
      method: "POST",
      headers: authB,
      data: { address_1: "HIJACKED" },
    });
    const deleteByB = await request.fetch(`${base}/store/customers/me/addresses/${addressId}`, {
      method: "DELETE",
      headers: authB,
    });
    expect(updateByB.status(), "B cannot update A's address (NOT_FOUND)").toBe(404);
    expect(deleteByB.status(), "B cannot delete A's address (NOT_FOUND)").toBe(404);

    // After: unchanged for A.
    const after = (await (
      await request.fetch(`${base}/store/customers/me/addresses`, { headers: authA })
    ).json()) as {
      addresses: { id: string; address_1: string }[];
    };
    expect(
      after.addresses.find((x) => x.id === addressId)?.address_1,
      "after: A's address unchanged",
    ).toBe("9 Original Rd");
  });
});
