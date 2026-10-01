import assert from "node:assert/strict";
import { test } from "node:test";

const promo = await import("@/src/lib/promotions");

type Item = Parameters<typeof promo.planEntry>[0] extends infer P ? (P extends { items: infer I } ? I : never) : never;

const item = (key: string, extra: Record<string, unknown> = {}) =>
  ({
    key,
    source: "package",
    eyebrow: "e",
    title: key,
    body: null,
    facts: [],
    price: null,
    priceNote: null,
    imageUrl: null,
    videoUrl: null,
    visual: "iptv",
    tone: "brand",
    cta: null,
    ...extra,
  }) as Item extends (infer X)[] ? X : never;

const guest = { state: "GUEST", vip: false } as const;
const expired = { state: "EXPIRED", vip: false } as const;
const active = { state: "ACTIVE", vip: false } as const;
const expiring = { state: "EXPIRING", vip: false } as const;
const vip = { state: "ACTIVE", vip: true } as const;

test("audiences match the right viewers", () => {
  assert.equal(promo.audienceMatches("ALL", guest), true);
  assert.equal(promo.audienceMatches("GUEST", guest), true);
  assert.equal(promo.audienceMatches("GUEST", { state: "NONE", vip: false }), true);
  assert.equal(promo.audienceMatches("GUEST", active), false);
  assert.equal(promo.audienceMatches("EXPIRED", expired), true);
  assert.equal(promo.audienceMatches("EXPIRED", guest), false);
  assert.equal(promo.audienceMatches("ACTIVE", expiring), true);
  assert.equal(promo.audienceMatches("ACTIVE", expired), false);
  assert.equal(promo.audienceMatches("EXPIRING", active), false);
  assert.equal(promo.audienceMatches("VIP", vip), true);
  assert.equal(promo.audienceMatches("VIP", active), false);
  assert.equal(promo.audienceMatches("VIP", { state: "EXPIRED", vip: true }), false);
  assert.equal(promo.audienceMatches("SOMETHING", guest), false);
  assert.equal(promo.isMember(expiring), true);
  assert.equal(promo.isMember(expired), false);
});

test("inactive, not-yet-started and ended items are never live", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  assert.equal(promo.isScheduledLive({ isActive: false, startsAt: null, endsAt: null }, now), false);
  assert.equal(promo.isScheduledLive({ isActive: true, startsAt: null, endsAt: null }, now), true);
  assert.equal(promo.isScheduledLive({ isActive: true, startsAt: "2026-09-28T00:00:00Z", endsAt: null }, now), false);
  assert.equal(promo.isScheduledLive({ isActive: true, startsAt: null, endsAt: "2026-09-26T00:00:00Z" }, now), false);
  assert.equal(promo.isScheduledLive({ isActive: true, startsAt: "2026-09-20 00:00:00+00", endsAt: "2026-10-01 00:00:00+00" }, now), true);
});

test("video media needs VIDEO type and a URL; otherwise the image is used", () => {
  assert.deepEqual(promo.mediaOf({ mediaType: "VIDEO", videoUrl: "/v.mp4", imageUrl: "/p.jpg" }), { type: "VIDEO", videoUrl: "/v.mp4", imageUrl: "/p.jpg" });
  assert.equal(promo.mediaOf({ mediaType: "VIDEO", videoUrl: null, imageUrl: "/p.jpg" }).type, "IMAGE");
  assert.equal(promo.mediaOf({ mediaType: "IMAGE", videoUrl: "/v.mp4", imageUrl: null }).videoUrl, null);
});

test("guests: least recently shown first, and it changes across sessions", () => {
  const payload = { mode: "guest" as const, items: [item("a"), item("b"), item("c")] };
  const first = promo.planEntry(payload, promo.EMPTY_ENTRY_HISTORY);
  assert.equal(first.plan?.primary.key, "a");
  const second = promo.planEntry(payload, first.history);
  assert.equal(second.plan?.primary.key, "b");
  const third = promo.planEntry(payload, second.history);
  assert.equal(third.plan?.primary.key, "c");
  const fourth = promo.planEntry(payload, third.history);
  assert.equal(fourth.plan?.primary.key, "a", "after all were shown, the oldest comes back");
  assert.equal(fourth.history.sessions, 4);
  assert.equal(first.plan?.secondary.length, 0);
});

test("no eligible item → no plan", () => {
  assert.equal(promo.planEntry({ mode: "none" }).plan, null);
  assert.equal(promo.planEntry({ mode: "guest", items: [] }).plan, null);
});

test("members: urgent items (incident before renewal) always lead; the rest rotate", () => {
  const payload = {
    mode: "member" as const,
    items: [item("incident:1", { urgent: true }), item("renewal:2", { urgent: true }), item("news:3"), item("offer:4")],
  };
  const first = promo.planEntry(payload, promo.EMPTY_ENTRY_HISTORY);
  assert.equal(first.plan?.primary.key, "incident:1");
  assert.deepEqual(first.plan?.secondary.map((entry) => entry.key), ["renewal:2", "news:3"]);
  const again = promo.planEntry(payload, first.history);
  assert.equal(again.plan?.primary.key, "incident:1", "urgent items are not skipped for freshness");

  const calm = { mode: "member" as const, items: [item("news:3"), item("offer:4")] };
  const one = promo.planEntry(calm, { recent: ["news:3"], sessions: 3 });
  assert.equal(one.plan?.primary.key, "offer:4", "recently shown news is avoided");
});

test("history is sanitised and capped", () => {
  assert.deepEqual(promo.sanitizeHistory(null), { recent: [], sessions: 0 });
  assert.deepEqual(promo.sanitizeHistory({ recent: ["a", 3, "b"], sessions: -2 }), { recent: ["a", "b"], sessions: 0 });
  const payload = { mode: "guest" as const, items: Array.from({ length: 20 }, (_, index) => item(`k${index}`)) };
  let history = promo.EMPTY_ENTRY_HISTORY;
  for (let index = 0; index < 15; index += 1) history = promo.planEntry(payload, history).history;
  assert.equal(history.recent.length, 12);
});

test("checkout and sign-in pages never show an entry experience", () => {
  for (const path of ["/checkout", "/login", "/register", "/forgot-password", "/reset-password"]) assert.equal(promo.isQuietPath(path), true);
  for (const path of ["/", "/plans", "/dashboard", "/checkoutx"]) assert.equal(promo.isQuietPath(path), false);
});
