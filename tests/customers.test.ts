import assert from "node:assert/strict";
import { test } from "node:test";

const customers = await import("@/src/lib/customers");

test("a customer's status summarises deriveSubscriptionState results", () => {
  assert.equal(customers.customerStatus([]), "NONE");
  assert.equal(customers.customerStatus(["EXPIRED", "ACTIVE"]), "ACTIVE");
  assert.equal(customers.customerStatus(["EXPIRED", "EXPIRING"]), "EXPIRING");
  assert.equal(customers.customerStatus(["SUSPENDED", "EXPIRED"]), "EXPIRED");
  assert.equal(customers.customerStatus(["SUSPENDED"]), "SUSPENDED");
});

test("filters are backed by real data only", () => {
  const row = (status: Parameters<typeof customers.matchesCustomerFilter>[1]["status"], staff = false, recent = false) => ({ status, staff, recent });
  assert.ok(customers.matchesCustomerFilter("active", row("EXPIRING")));
  assert.ok(!customers.matchesCustomerFilter("active", row("EXPIRED")));
  assert.ok(customers.matchesCustomerFilter("expiring", row("EXPIRING")));
  assert.ok(customers.matchesCustomerFilter("expired", row("EXPIRED")));
  assert.ok(customers.matchesCustomerFilter("none", row("NONE")));
  assert.ok(!customers.matchesCustomerFilter("none", row("NONE", true)), "staff aren't 'customers without a plan'");
  assert.ok(customers.matchesCustomerFilter("recent", row(null, false, true)));
  assert.ok(customers.matchesCustomerFilter("staff", row(null, true)));
  assert.deepEqual([...customers.SUBSCRIPTION_FILTERS], ["active", "expiring", "expired", "none"]);
});

test("URL query parsing is strict", () => {
  assert.deepEqual(customers.parseCustomerQuery({}), { q: "", filter: "all", page: 1 });
  assert.deepEqual(customers.parseCustomerQuery({ q: " Ali ", view: "expiring", page: "3" }), { q: "Ali", filter: "expiring", page: 3 });
  assert.deepEqual(customers.parseCustomerQuery({ view: "vip", page: "-2" }), { q: "", filter: "all", page: 1 });
});

test("search recognises ids and order numbers", () => {
  assert.deepEqual(customers.parseCustomerSearch("Ali"), { text: "ali", numeric: null, orderId: null });
  assert.deepEqual(customers.parseCustomerSearch("#42"), { text: "#42", numeric: 42, orderId: null });
  assert.equal(customers.parseCustomerSearch("SH-000123").orderId, 123);
  assert.equal(customers.parseCustomerSearch("sh‑000123").orderId, 123, "non-breaking hyphen as shown in the UI");
  assert.equal(customers.parseCustomerSearch("0790").numeric, 790, "digits are also tried as an id; phone matching is separate");
});
