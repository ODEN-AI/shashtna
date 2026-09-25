import assert from "node:assert/strict";
import { test } from "node:test";

const orders = await import("@/src/lib/order-status");
const subs = await import("@/src/lib/subscription-state");
const roles = await import("@/src/lib/roles");

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

test("legacy order statuses map onto the new state machine", () => {
  assert.equal(orders.normalizeOrderStatus("PENDING"), "SUBMITTED");
  assert.equal(orders.normalizeOrderStatus("ACCEPTED"), "COMPLETED");
  assert.equal(orders.normalizeOrderStatus("REJECTED"), "REJECTED");
  assert.equal(orders.normalizeOrderStatus("paid"), "PAID");
});

test("order transitions follow the state machine", () => {
  assert.ok(orders.canTransition("SUBMITTED", "AWAITING_PAYMENT"));
  assert.ok(orders.canTransition("PENDING", "PAID"));
  assert.ok(orders.canTransition("PAID", "COMPLETED"));
  assert.ok(!orders.canTransition("COMPLETED", "SUBMITTED"));
  assert.ok(!orders.canTransition("REJECTED", "PAID"));
  assert.ok(!orders.canTransition("SUBMITTED", "BOGUS"));
});

test("only unpaid orders are cancellable by the customer", () => {
  assert.ok(orders.isUnpaid("PENDING"));
  assert.ok(orders.isUnpaid("AWAITING_PAYMENT"));
  assert.ok(!orders.isUnpaid("PAID"));
  assert.ok(orders.isOpen("FULFILLING"));
  assert.ok(!orders.isOpen("CANCELLED"));
});

test("order numbers round-trip", () => {
  assert.equal(orders.formatOrderNumber(42), "SH-000042");
  assert.equal(orders.parseOrderNumber("sh-000042"), 42);
  assert.equal(orders.parseOrderNumber("42"), 42);
  assert.equal(orders.parseOrderNumber("x42"), null);
});

test("timeline marks done / current / upcoming", () => {
  const steps = orders.orderTimeline("PAID").map((step) => step.state);

  assert.deepEqual(steps, ["done", "done", "current", "upcoming", "upcoming"]);
  assert.ok(orders.orderTimeline("COMPLETED").every((step) => step.state === "done"));
});

test("subscription state is derived from expiry", () => {
  assert.equal(subs.deriveSubscriptionState({ status: "ACTIVE", expiryDate: iso(30) }), "ACTIVE");
  assert.equal(subs.deriveSubscriptionState({ status: "ACTIVE", expiryDate: iso(3) }), "EXPIRING");
  assert.equal(subs.deriveSubscriptionState({ status: "ACTIVE", expiryDate: iso(0) }), "EXPIRING");
  assert.equal(subs.deriveSubscriptionState({ status: "ACTIVE", expiryDate: iso(-2) }), "EXPIRED");
  assert.equal(subs.deriveSubscriptionState({ status: "EXPIRED", expiryDate: iso(20) }), "EXPIRED");
  assert.equal(
    subs.deriveSubscriptionState({ status: "ACTIVE", expiryDate: "2026-09-30 04:42:27.79+00" }, Date.parse("2026-09-01")),
    "ACTIVE",
  );
});

test("account state prefers a live subscription over an open order", () => {
  const active = { status: "ACTIVE", expiryDate: iso(40) };
  const expired = { status: "ACTIVE", expiryDate: iso(-5) };

  assert.equal(subs.deriveAccountState(active, true), "ACTIVE");
  assert.equal(subs.deriveAccountState(expired, true), "PENDING");
  assert.equal(subs.deriveAccountState(expired, false), "EXPIRED");
  assert.equal(subs.deriveAccountState(undefined, false), "NONE");
  assert.equal(subs.deriveAccountState(undefined, true), "PENDING");
});

test("primary subscription is the healthiest, longest-running one", () => {
  const picked = subs.pickPrimarySubscription([
    { id: 1, status: "ACTIVE", expiryDate: iso(-10) },
    { id: 2, status: "ACTIVE", expiryDate: iso(20) },
    { id: 3, status: "ACTIVE", expiryDate: iso(90) },
  ]);

  assert.equal(picked?.id, 3);
});

test("roles grant only their permissions; legacy ADMIN keeps full access", () => {
  assert.ok(roles.hasPermission("ADMIN", "staff"));
  assert.ok(roles.hasPermission("owner", "settings"));
  assert.ok(roles.hasPermission("OPERATOR", "orders"));
  assert.ok(!roles.hasPermission("OPERATOR", "settings"));
  assert.ok(roles.hasPermission("SUPPORT", "support"));
  assert.ok(!roles.hasPermission("SUPPORT", "orders"));
  assert.ok(roles.hasPermission("CONTENT", "catalogue"));
  assert.ok(!roles.hasPermission("CUSTOMER", "support"));
  assert.ok(!roles.hasPermission(undefined, "support"));
});

const redirect = await import("@/src/lib/redirect");

test("post-login redirects stay on this site", () => {
  assert.equal(redirect.safeRedirect("/checkout?plan=iptv-1y"), "/checkout?plan=iptv-1y");
  assert.equal(redirect.safeRedirect("//evil.example"), "/dashboard");
  assert.equal(redirect.safeRedirect("/\\evil.example"), "/dashboard");
  assert.equal(redirect.safeRedirect("https://evil.example"), "/dashboard");
  assert.equal(redirect.safeRedirect(undefined), "/dashboard");
});

test("a chosen plan survives registration and login", () => {
  assert.equal(redirect.postAuthDestination({ plan: "iptv-1y" }), "/checkout?plan=iptv-1y");
  assert.equal(
    redirect.postAuthDestination({ redirect: "/checkout?plan=vip-3m&device=1" }),
    "/checkout?plan=vip-3m&device=1",
  );
  assert.equal(redirect.postAuthDestination({ plan: "../../x" }), "/dashboard");
});
