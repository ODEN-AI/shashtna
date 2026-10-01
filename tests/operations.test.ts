import assert from "node:assert/strict";
import { test } from "node:test";

const ops = await import("@/src/lib/operations");
const roles = await import("@/src/lib/roles");

test("every queue is guarded by the permission its existing page and actions use", () => {
  assert.deepEqual(ops.QUEUE_PERMISSION, { payments: "orders", orders: "orders", activations: "orders", renewals: "subscriptions", support: "support", leads: "orders" });
  // CONTENT can reach none of them; OPERATOR all; SUPPORT only support.
  const reachable = (role: string) => Object.entries(ops.QUEUE_PERMISSION).filter(([, permission]) => roles.hasPermission(role, permission)).map(([queue]) => queue);
  assert.deepEqual(reachable("CONTENT"), []);
  assert.deepEqual(reachable("SUPPORT"), ["support"]);
  assert.deepEqual(reachable("OPERATOR"), ["payments", "orders", "activations", "renewals", "support", "leads"]);
});

test("URL filters are parsed strictly (unknown values fall back)", () => {
  assert.deepEqual(ops.parseOperationsQuery({}), { queue: "overview", q: "", since: "all" });
  assert.deepEqual(ops.parseOperationsQuery({ queue: "payments", q: "  SH-000012 ", since: "7d" }), { queue: "payments", q: "SH-000012", since: "7d" });
  assert.deepEqual(ops.parseOperationsQuery({ queue: "admin", since: "forever" }), { queue: "overview", q: "", since: "all" });
  assert.equal(ops.parseOperationsQuery({ q: "x".repeat(500) }).q.length, 80);
});

test("the since window uses Baghdad business days", () => {
  // 2026-10-01 00:30 Baghdad = 2026-09-30 21:30 UTC
  const now = new Date("2026-09-30T21:30:00Z");
  assert.equal(ops.sinceStart("all", now), null);
  assert.equal(ops.sinceStart("today", now)?.toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(ops.sinceStart("7d", now)?.toISOString(), "2026-09-24T21:00:00.000Z");
  assert.ok(ops.withinSince("2026-09-30 21:15:00+00", ops.sinceStart("today", now)));
  assert.ok(!ops.withinSince("2026-09-30T20:59:00Z", ops.sinceStart("today", now)));
  assert.ok(ops.withinSince(null, null));
  assert.ok(!ops.withinSince(null, ops.sinceStart("today", now)));
});

test("search matches any field, case-insensitively", () => {
  assert.ok(ops.matchesSearch("", ["anything"]));
  assert.ok(ops.matchesSearch("sh-0000", ["SH-000012", null]));
  assert.ok(ops.matchesSearch("0790", [undefined, "07901234567"]));
  assert.ok(!ops.matchesSearch("vip", ["IPTV سنة", 12]));
});

test("queues are ordered by waiting time, oldest first, deterministically", () => {
  const items = [
    { id: 3, since: "2026-09-03T10:00:00Z" },
    { id: 1, since: "2026-09-01 10:00:00+00" },
    { id: 2, since: "2026-09-01T10:00:00Z" },
  ];
  assert.deepEqual(ops.oldestFirst(items).map((item) => item.id), [1, 2, 3]);
});
