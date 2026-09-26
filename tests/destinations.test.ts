import assert from "node:assert/strict";
import { test } from "node:test";

const { destinationLink, makeDestination, parseDestination, safeNotificationLink } = await import("@/src/lib/destinations");

test("every destination round-trips through its stored link", () => {
  const samples = [
    { kind: "HOME" },
    { kind: "PLANS" },
    { kind: "PLAN", slug: "iptv-12-months" },
    { kind: "ANNOUNCEMENT", id: 7 },
    { kind: "ORDERS" },
    { kind: "ORDER", id: 123 },
    { kind: "SUBSCRIPTIONS" },
    { kind: "SUBSCRIPTION", id: 9 },
    { kind: "SUPPORT" },
    { kind: "TICKET", id: "ST-MFX1-ABCD1234" },
    { kind: "STATUS" },
    { kind: "NOTIFICATIONS" },
  ] as const;

  for (const destination of samples) {
    assert.deepEqual(parseDestination(destinationLink(destination)), destination);
  }
});

test("links the backend already writes are understood", () => {
  assert.deepEqual(parseDestination("/orders/42"), { kind: "ORDER", id: 42 });
  assert.deepEqual(parseDestination("/subscriptions/5"), { kind: "SUBSCRIPTION", id: 5 });
  assert.deepEqual(parseDestination("/support/ST-ABC-1234"), { kind: "TICKET", id: "ST-ABC-1234" });
  assert.deepEqual(parseDestination("/orders?tab=receipts"), { kind: "ORDERS" });
  assert.deepEqual(parseDestination("/support/new"), { kind: "SUPPORT" });
});

test("unsafe or unknown links are rejected", () => {
  for (const link of [
    "https://evil.example/orders/1",
    "//evil.example/orders/1",
    "javascript:alert(1)",
    "/\\evil.example",
    "/admin",
    "/orders/abc",
    "/orders/0",
    "/orders/1/extra",
    "/announcements",
    "/checkout?plan=../../etc",
    "",
    null,
    undefined,
  ]) {
    assert.equal(parseDestination(link), null, String(link));
  }
});

test("safeNotificationLink stores only canonical internal links", () => {
  assert.equal(safeNotificationLink("/orders/12?x=1"), "/orders/12");
  assert.equal(safeNotificationLink("https://example.com"), null);
  assert.equal(safeNotificationLink("/subscriptions"), "/subscriptions");
});

test("makeDestination validates admin input", () => {
  assert.equal(makeDestination("ORDER", "-1"), null);
  assert.deepEqual(makeDestination("order", "12"), { kind: "ORDER", id: 12 });
  assert.equal(makeDestination("PLAN", "bad slug!"), null);
  assert.equal(makeDestination("TICKET", "<script>"), null);
  assert.equal(makeDestination("NOPE"), null);
});
