import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:5432/test";

const { parseDestination } = await import("@/src/server/mobile/destinations");
const { issuedAfterRevocation } = await import("@/src/server/mobile/sessions");
const { claimsOtherUser, serializeMobileUser } = await import("@/src/server/mobile/http");
const { serializeAnnouncement, shapeSubscription, shapeTicket, shapeNotification, absoluteUrl } = await import("@/src/server/mobile/shape");
const { contactOptionsFrom } = await import("@/src/server/checkout-selection");

// ------------------------------------------------------------------ contract

/**
 * Every call the Shashtna app makes (shashtna-mobile src/api/*, plus the
 * older single-file build): path → methods. A missing route here is exactly
 * the production 404 this branch fixes.
 */
const CONTRACT: Record<string, string[]> = {
  "auth/login": ["POST"],
  "auth/register": ["POST"],
  "auth/password-reset/request": ["POST"],
  "auth/password-reset/complete": ["POST"],
  "auth/logout-all": ["POST"],
  me: ["GET", "PATCH"],
  "me/password": ["POST"],
  dashboard: ["GET"],
  catalog: ["GET"],
  content: ["GET"],
  "content/[id]": ["GET"],
  status: ["GET"],
  help: ["GET"],
  checkout: ["GET"],
  orders: ["GET", "POST"],
  "orders/[id]": ["GET"],
  "orders/[id]/cancel": ["POST"],
  "orders/[id]/proof": ["GET", "POST"],
  subscriptions: ["GET"],
  "subscriptions/[id]": ["GET"],
  "support/tickets": ["GET", "POST"],
  "support/tickets/[id]": ["GET", "POST"],
  notifications: ["GET"],
  "notifications/read": ["POST"],
  devices: ["POST", "DELETE"],
  // Older build (v1.0.0) only:
  "account/profile": ["PUT"],
  receipts: ["GET"],
  "subscription-requests": ["GET", "POST"],
  config: ["GET"],
};

test("every endpoint and method the app calls exists", () => {
  for (const [path, methods] of Object.entries(CONTRACT)) {
    const file = `app/api/mobile/${path}/route.ts`;
    assert.ok(existsSync(file), file);
    const source = readFileSync(file, "utf8");
    for (const method of methods) {
      assert.match(source, new RegExp(`export (const|async function) ${method}\\b`), `${method} /api/mobile/${path}`);
    }
  }
});

test("mobile routes reuse the current services (no second order/auth/catalogue system)", () => {
  const read = (path: string) => readFileSync(`app/api/mobile/${path}/route.ts`, "utf8");
  assert.match(read("orders"), /createOrder\(/);
  assert.doesNotMatch(read("orders"), /body\.price|body\.total|body\.status/, "client price/total/status never read");
  assert.match(read("auth/login"), /passwordSignIn\(/);
  assert.match(read("auth/register"), /registerCustomer\(/);
  assert.match(read("catalog"), /getActivePackages\(\)/);
  assert.match(readFileSync("app/api/auth/login/route.ts", "utf8"), /passwordSignIn\(/, "website login uses the same function");
  assert.match(readFileSync("app/(site)/checkout/page.tsx", "utf8"), /resolveCheckoutSelection\(/, "website checkout uses the same resolver");
  for (const path of Object.keys(CONTRACT)) {
    const source = read(path);
    assert.doesNotMatch(source, /requireMobileAuth/, `${path}: signature-only auth`);
    assert.doesNotMatch(source, /console\.log/, `${path}: no logging`);
  }
});

// ------------------------------------------------------------------ auth

test("sign-out-everywhere: tokens from the revocation's second or earlier are refused", () => {
  const revokedAt = Date.UTC(2026, 9, 2, 12, 0, 0, 400);
  const second = Math.floor(revokedAt / 1000);
  assert.equal(issuedAfterRevocation(second - 60, null), true, "never revoked");
  assert.equal(issuedAfterRevocation(second - 60, revokedAt), false);
  assert.equal(issuedAfterRevocation(second, revokedAt), false, "same second fails closed");
  assert.equal(issuedAfterRevocation(second + 1, revokedAt), true, "fresh token after the revocation");
});

test("a client-sent userId is never trusted", () => {
  assert.equal(claimsOtherUser(undefined, 5), false);
  assert.equal(claimsOtherUser("", 5), false);
  assert.equal(claimsOtherUser("5", 5), false);
  assert.equal(claimsOtherUser(6, 5), true);
});

test("user serialization exposes no password hash", () => {
  const user = serializeMobileUser({
    id: 3, name: "علي", phone: "0770", email: null, passwordHash: "$2b$12$secret", role: "customer", createdAt: "2026-01-01", updatedAt: "2026-01-01",
    preferredContact: "WHATSAPP", renewalReminders: true, marketingOptIn: false,
  } as never);
  assert.equal(user.role, "CUSTOMER");
  assert.equal(user.isStaff, false);
  assert.ok(!JSON.stringify(user).includes("secret"));
  assert.ok(!("passwordHash" in user));
});

// ------------------------------------------------------------------ subscriptions

const SUBSCRIPTION = {
  id: 9, serviceType: "IPTV", packageName: "سنة", packageId: 1, packageSlug: "year", status: "ACTIVE", state: "ACTIVE" as const,
  daysRemaining: 200, remainingFraction: 0.5, startDate: "2026-01-01", expiryDate: "2027-01-01",
  username: "iptv-user", password: "iptv-pass", macAddress: "00:1A:2B", deviceId: "dev-1", connections: 1, maxConnections: 2, createdAt: "2026-01-01",
};

test("subscription lists never carry IPTV credentials; the detail does", () => {
  const listed = shapeSubscription(SUBSCRIPTION);
  assert.equal(listed.credentials, null);
  for (const key of ["username", "password", "macAddress", "deviceId"] as const) assert.equal(listed[key], null, key);
  assert.ok(!JSON.stringify(listed).includes("iptv-pass"));
  assert.equal(listed.connections, 1, "older builds still get connections");
  assert.equal(listed.stateLabel.length > 0, true);
  assert.equal(listed.canRenew, true);

  const detail = shapeSubscription(SUBSCRIPTION, { credentials: true });
  assert.deepEqual(detail.credentials, { username: "iptv-user", password: "iptv-pass", macAddress: "00:1A:2B", deviceId: "dev-1" });
});

// ------------------------------------------------------------------ content

const request = new Request("https://shashtna.netlify.app/api/mobile/content");
const ad = {
  id: 7, kind: "AD", title: "Champions League", description: "عرض", imageUrl: "/uploads/media/cl.jpg", ctaLabel: "اشترك", ctaUrl: "/checkout?plan=year",
  target: "ALL", placement: "HOME_CAROUSEL", mediaType: "VIDEO", videoUrl: "https://cdn.example/cl.mp4", audience: "ALL", highlight: null,
  style: "HIGHLIGHT", priority: 5, isActive: true, startsAt: null, endsAt: null, createdAt: "2026-10-01", updatedAt: "2026-10-01",
};

test("admin ads become app offers with typed destinations and absolute media", () => {
  const item = serializeAnnouncement(request, ad as never);
  assert.equal(item.kind, "OFFER");
  assert.equal(item.imageUrl, "https://shashtna.netlify.app/uploads/media/cl.jpg");
  assert.equal(item.mediaType, "VIDEO");
  assert.equal(item.videoUrl, "https://cdn.example/cl.mp4");
  assert.deepEqual(item.cta, { label: "اشترك", destination: { kind: "PLAN", slug: "year" }, externalUrl: null });

  assert.equal(serializeAnnouncement(request, { ...ad, kind: "ANNOUNCEMENT" } as never).kind, "ANNOUNCEMENT");
  assert.equal(serializeAnnouncement(request, { ...ad, kind: "NEWS" } as never).kind, "ANNOUNCEMENT");
  const external = serializeAnnouncement(request, { ...ad, ctaUrl: "https://star10.example/promo" } as never);
  assert.deepEqual(external.cta, { label: "اشترك", destination: null, externalUrl: "https://star10.example/promo" });
  assert.equal(serializeAnnouncement(request, { ...ad, ctaUrl: "javascript:alert(1)" } as never).cta?.externalUrl, null);
});

test("media URLs: only https or same-origin paths", () => {
  assert.equal(absoluteUrl(request, "http://insecure.example/a.jpg"), null);
  assert.equal(absoluteUrl(request, "//evil.example/a.jpg"), null);
  assert.equal(absoluteUrl(request, ""), null);
});

test("destinations: website paths → typed app destinations, anything else null", () => {
  const cases: [string, unknown][] = [
    ["/dashboard", { kind: "HOME" }],
    ["/plans?service=VIP", { kind: "PLANS" }],
    ["/devices", { kind: "PLANS" }],
    ["/checkout?plan=year", { kind: "PLAN", slug: "year" }],
    ["/orders/12", { kind: "ORDER", id: 12 }],
    ["/subscriptions/3", { kind: "SUBSCRIPTION", id: 3 }],
    ["/support/abc_123", { kind: "TICKET", id: "abc_123" }],
    ["/support/new", { kind: "SUPPORT" }],
    ["/status", { kind: "STATUS" }],
    ["/notifications", { kind: "NOTIFICATIONS" }],
  ];
  for (const [link, want] of cases) assert.deepEqual(parseDestination(link), want, link);
  for (const bad of ["https://evil.example/orders/1", "//evil.example", "/orders/abc", "/orders/1/2", "/admin", "javascript:x", "", null]) {
    assert.equal(parseDestination(bad), null, String(bad));
  }
});

// ------------------------------------------------------------------ support & notifications

test("tickets: both app generations' fields, staff names hidden", () => {
  const ticket = shapeTicket({
    id: "t1", userId: 4, userName: "زيد", userPhone: "0770", subject: "مشكلة", category: "playback", status: "OPEN",
    createdAt: "2026-10-01", updatedAt: "2026-10-02", lastSender: "ADMIN",
    messages: [
      { id: "m1", sender: "CUSTOMER", senderName: "زيد", message: "ما يشتغل", createdAt: "2026-10-01" },
      { id: "m2", sender: "ADMIN", senderName: "Staff Member Ahmed", message: "جرّب إعادة التشغيل", createdAt: "2026-10-02" },
    ],
  } as never);
  assert.equal(ticket.statusLabel, "مفتوحة");
  assert.equal(ticket.lastMessage, "جرّب إعادة التشغيل");
  assert.equal(ticket.context, null);
  assert.equal(ticket.messages.length, 2, "older builds read the conversation from the list");
  assert.equal(ticket.messages[1].senderName, "دعم شاشتنا");
  assert.ok(!JSON.stringify(ticket).includes("Ahmed"));
});

test("notifications carry a typed destination, never a raw link", () => {
  const item = shapeNotification({ id: 1, type: "ORDER", title: "t", body: "b", link: "/orders/5", readAt: null, createdAt: "2026-10-01" });
  assert.deepEqual(item.destination, { kind: "ORDER", id: 5 });
  assert.ok(!("link" in item));
});

// ------------------------------------------------------------------ checkout / help

test("contact options follow Admin settings; WhatsApp whenever configured", () => {
  const base = { "contact.telegram": "", "contact.whatsapp": "", "contact.facebook": "" } as never;
  assert.deepEqual(contactOptionsFrom(base), ["PHONE"]);
  const all = { "contact.telegram": "https://t.me/shashtna", "contact.whatsapp": "+964 770 000 0000", "contact.facebook": "https://facebook.com/shashtna" } as never;
  assert.deepEqual(contactOptionsFrom(all), ["TELEGRAM", "WHATSAPP", "FACEBOOK", "PHONE"]);
  const whatsappOnly = { "contact.telegram": "", "contact.whatsapp": "07700000000", "contact.facebook": "" } as never;
  assert.deepEqual(contactOptionsFrom(whatsappOnly), ["WHATSAPP", "PHONE"]);
});
