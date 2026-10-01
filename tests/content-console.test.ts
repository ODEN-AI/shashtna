import assert from "node:assert/strict";
import { test } from "node:test";

const content = await import("@/src/lib/content-console");

test("strict choices: empty → default, unknown → rejected (never silently replaced)", () => {
  assert.equal(content.strictChoice("", ["ALL", "VIP"], "ALL"), "ALL");
  assert.equal(content.strictChoice("vip", ["ALL", "VIP"], "ALL"), "VIP");
  assert.equal(content.strictChoice("EVERYONE", ["ALL", "VIP"], "ALL"), null);
});

test("priority is a whole number in −100…100", () => {
  assert.equal(content.strictPriority(""), 0);
  assert.equal(content.strictPriority("5"), 5);
  assert.equal(content.strictPriority("-100"), -100);
  assert.equal(content.strictPriority("101"), null);
  assert.equal(content.strictPriority("2.5"), null);
  assert.equal(content.strictPriority("abc"), null);
});

test("links", () => {
  assert.ok(content.isSafeLink("/plans"));
  assert.ok(content.isSafeLink("https://shashtna.example/x"));
  assert.ok(!content.isSafeLink("http://insecure.example"));
  assert.ok(!content.isSafeLink("javascript:alert(1)"));
  assert.ok(!content.isSafeLink("//evil.example"));
  assert.ok(content.isInternalPath("/subscriptions"));
  assert.ok(!content.isInternalPath("https://shashtna.example"));
  assert.ok(!content.isInternalPath("/\\evil.example"));
});

test("surfaces follow the public consumers", () => {
  assert.deepEqual(content.surfacesOf({ placement: "HERO_EDITORIAL", target: "WEBSITE", kind: "OFFER" }), { website: ["/ — hero offers & news board"], player: false });
  assert.deepEqual(content.surfacesOf({ placement: "BANNER", target: "ALL", kind: "AD" }), { website: [], player: true }, "no website page renders BANNER");
  assert.deepEqual(content.surfacesOf({ placement: "HOME_CAROUSEL", target: "PLAYER", kind: "AD" }), { website: [], player: true });
  assert.deepEqual(content.surfacesOf({ placement: "HOME_CAROUSEL", target: "ALL", kind: "NEWS" }).website, ["/ — hero board (after HERO_EDITORIAL items)", "/ — latest announcements"], "news outside reserved placements also feeds the latest list");
  assert.deepEqual(content.surfacesOf({ placement: "DASHBOARD", target: "WEBSITE", kind: "NEWS" }).website, ["/dashboard — customer notices"]);
});

test("lifecycle views", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  assert.ok(content.matchesView("live", "LIVE", null, now));
  assert.ok(!content.matchesView("live", "SCHEDULED", null, now));
  assert.ok(content.matchesView("ending", "LIVE", now + 3 * 86_400_000, now));
  assert.ok(!content.matchesView("ending", "LIVE", now + 30 * 86_400_000, now));
  assert.ok(!content.matchesView("ending", "LIVE", null, now), "no end date → not ending");
  assert.ok(content.matchesView("all", "INACTIVE", null, now));
});

test("URL query parsing is strict", () => {
  const placements = ["HERO_EDITORIAL", "BANNER"];
  const audiences = ["ALL", "VIP"];
  assert.deepEqual(content.parseContentQuery({}, placements, audiences), { q: "", view: "all", placement: "all", audience: "all", page: 1 });
  assert.deepEqual(content.parseContentQuery({ q: " x ", view: "live", placement: "banner", audience: "vip", page: "2" }, placements, audiences), { q: "x", view: "live", placement: "BANNER", audience: "VIP", page: 2 });
  assert.deepEqual(content.parseContentQuery({ view: "bogus", placement: "NOPE", audience: "NOPE", page: "-1" }, placements, audiences), { q: "", view: "all", placement: "all", audience: "all", page: 1 });
});

test("search", () => {
  const item = { id: 7, title: "عرض الصيف", description: "خصم VIP", highlight: "35,000 د.ع", ctaLabel: "اشترك" };
  assert.ok(content.matchesContent("الصيف", item));
  assert.ok(content.matchesContent("vip", item));
  assert.ok(content.matchesContent("#7", item));
  assert.ok(!content.matchesContent("#8", item));
  assert.ok(!content.matchesContent("شتاء", item));
});
