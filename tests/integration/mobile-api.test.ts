/**
 * Integration tests for the mobile API and the website ↔ mobile acceptance
 * scenarios. They call the real route handlers and services against a real
 * PostgreSQL database (DATABASE_URL, migrated with `prisma db migrate`).
 * Only the push provider's HTTP endpoint is replaced, so no notification
 * leaves the machine.
 *
 *   npm run test:integration
 *
 * Every row created here uses a unique phone/slug prefix and is left in the
 * database, so never point DATABASE_URL at production.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

process.env.SHASHTNA_STORAGE = "local";
process.env.AUTH_SECRET ??= "integration-test-secret-integration-test-secret";

const { db } = await import("@/src/prisma/db");
const { setPushTransport } = await import("@/src/server/push");
const { createCampaign, sendCampaign, dispatchDueCampaigns, cancelCampaign } = await import("@/src/server/push-campaigns");
const { updateOrderStatus } = await import("@/src/server/orders");
const { getLiveAnnouncements } = await import("@/src/server/content");

const login = await import("@/app/api/mobile/auth/login/route");
const register = await import("@/app/api/mobile/auth/register/route");
const me = await import("@/app/api/mobile/me/route");
const dashboard = await import("@/app/api/mobile/dashboard/route");
const catalog = await import("@/app/api/mobile/catalog/route");
const orders = await import("@/app/api/mobile/orders/route");
const orderDetail = await import("@/app/api/mobile/orders/[id]/route");
const orderCancel = await import("@/app/api/mobile/orders/[id]/cancel/route");
const orderProof = await import("@/app/api/mobile/orders/[id]/proof/route");
const content = await import("@/app/api/mobile/content/route");
const contentItem = await import("@/app/api/mobile/content/[id]/route");
const status = await import("@/app/api/mobile/status/route");
const notifications = await import("@/app/api/mobile/notifications/route");
const notificationsRead = await import("@/app/api/mobile/notifications/read/route");
const devices = await import("@/app/api/mobile/devices/route");
const subscriptions = await import("@/app/api/mobile/subscriptions/route");
const tickets = await import("@/app/api/mobile/support/tickets/route");
const ticket = await import("@/app/api/mobile/support/tickets/[id]/route");
const websiteAnnouncements = await import("@/app/api/announcements/route");

const RUN = Date.now().toString(36);
const DIGITS = String(Date.now()).slice(-8);
const BASE = "http://localhost:3000";
const sent: { to: string; title: string; data: { link: string | null; notificationId: number | null } }[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON bodies are asserted field by field
type Json = Record<string, any>;

function request(path: string, init: { method?: string; token?: string; body?: unknown; form?: FormData } = {}) {
  const headers = new Headers();

  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  return new Request(`${BASE}${path}`, {
    method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route handlers differ only in their params type
type Handler = (req: Request, ctx?: { params: Promise<any> }) => Promise<Response>;

async function call(handler: Handler, req: Request, params?: Record<string, string>) {
  const response = await handler(req, params ? { params: Promise.resolve(params) } : undefined);
  const type = response.headers.get("content-type") ?? "";
  return { status: response.status, body: (type.includes("json") ? await response.json() : null) as Json, response };
}

// 1x1 PNG
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
);

let customer: { token: string; id: number; phone: string };
let staff: { id: number; role: string };
let plan: { id: number; slug: string };
const pushToken = `ExponentPushToken[it${RUN}abcdefghijkl]`;

before(async () => {
  setPushTransport(async (url, body) => {
    if (url.endsWith("/send")) {
      const messages = body as typeof sent;
      sent.push(...messages);
      return { data: messages.map((_, index) => ({ status: "ok", id: `ticket-${RUN}-${sent.length}-${index}` })) };
    }

    return { data: {} };
  });

  const owner = await db.orm.public.User.create({ name: "Staff", phone: `+964-staff-${RUN}`, passwordHash: "x", role: "OWNER" });
  staff = { id: owner.id, role: "OWNER" };
  const pkg = await db.orm.public.Package.create({
    name: `IT Plan ${RUN}`,
    slug: `it-plan-${RUN}`,
    serviceType: "IPTV",
    price: 25000,
    durationMonths: 12,
    durationLabel: "1 Year",
    description: "Integration plan",
    specifications: "HD\n4K",
    isActive: true,
  });
  plan = { id: pkg.id, slug: pkg.slug };
});

after(() => setPushTransport(null));

describe("auth", () => {
  test("register returns a token for the same account system", async () => {
    const phone = `0770${DIGITS}`;
    const res = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Mobile Tester", phone, password: "secret123", terms: true } }));

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    customer = { token: res.body.token, id: res.body.user.id, phone };

    const dup = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Duplicate", phone, password: "secret123", terms: true } }));
    assert.equal(dup.status, 409);
  });

  test("login accepts the right password only", async () => {
    const bad = await call(login.POST, request("/api/mobile/auth/login", { body: { phone: customer.phone, password: "wrong" } }));
    assert.equal(bad.status, 401);
    assert.equal(bad.body.code, "INVALID_CREDENTIALS");

    const good = await call(login.POST, request("/api/mobile/auth/login", { body: { phone: customer.phone, password: "secret123" } }));
    assert.equal(good.status, 200);
    assert.equal(good.body.user.id, customer.id);
  });

  test("protected routes reject missing or forged tokens", async () => {
    assert.equal((await call(me.GET, request("/api/mobile/me"))).status, 401);
    assert.equal((await call(me.GET, request("/api/mobile/me", { token: "abc.def" }))).status, 401);
    const [payload, signature] = customer.token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), sub: staff.id })).toString("base64url");
    assert.equal((await call(me.GET, request("/api/mobile/me", { token: `${forged}.${signature}` }))).status, 401);
  });

  test("session restore and preference updates", async () => {
    const res = await call(me.GET, request("/api/mobile/me", { token: customer.token }));
    assert.equal(res.body.user.phone, customer.phone);

    const patched = await call(me.PATCH, request("/api/mobile/me", { method: "PATCH", token: customer.token, body: { marketingOptIn: true, preferredContact: "whatsapp" } }));
    assert.equal(patched.body.user.marketingOptIn, true);
    assert.equal(patched.body.user.preferredContact, "WHATSAPP");
  });
});

describe("packages and orders", () => {
  let orderId: number;

  test("catalog comes from the database and follows admin changes", async () => {
    let res = await call(catalog.GET, request("/api/mobile/catalog"));
    const found = res.body.packages.find((item: Json) => item.slug === plan.slug);
    assert.equal(found.price, 25000);
    assert.deepEqual(found.features, ["HD", "4K"]);

    await db.orm.public.Package.where({ id: plan.id }).update({ price: 27000 });
    res = await call(catalog.GET, request("/api/mobile/catalog"));
    assert.equal(res.body.packages.find((item: Json) => item.slug === plan.slug).price, 27000);
  });

  test("order creation uses the website order service (server price, no duplicates)", async () => {
    const res = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "NEW", planSlug: plan.slug, price: 1 } }));
    assert.equal(res.status, 201);
    assert.equal(res.body.order.price, 27000);
    assert.equal(res.body.order.stage, "PAYMENT_PENDING");
    assert.equal(res.body.order.needsPayment, true);
    assert.equal(res.body.order.payment.transfer.transferNumber.length > 0, true);
    orderId = res.body.order.id;

    const again = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "NEW", planSlug: plan.slug } }));
    assert.equal(again.status, 200);
    assert.equal(again.body.alreadyExists, true);
    assert.equal(again.body.order.id, orderId);
  });

  test("a disabled package can no longer be ordered", async () => {
    await db.orm.public.Package.where({ id: plan.id }).update({ isActive: false });
    const listed = await call(catalog.GET, request("/api/mobile/catalog"));
    assert.equal(listed.body.packages.some((item: Json) => item.slug === plan.slug), false);

    const res = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "RENEW", planSlug: plan.slug } }));
    assert.equal(res.status, 400);
    await db.orm.public.Package.where({ id: plan.id }).update({ isActive: true });
  });

  test("orders are private to their owner", async () => {
    const other = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Other", phone: `0771${DIGITS}`, password: "secret123", terms: true } }));
    const res = await call(orderDetail.GET, request(`/api/mobile/orders/${orderId}`, { token: other.body.token }), { id: String(orderId) });
    assert.equal(res.status, 404);
    const proof = await call(orderProof.GET, request(`/api/mobile/orders/${orderId}/proof`, { token: other.body.token }), { id: String(orderId) });
    assert.equal(proof.status, 404);
  });

  test("dashboard tells the customer to pay", async () => {
    const res = await call(dashboard.GET, request("/api/mobile/dashboard", { token: customer.token }));
    assert.equal(res.body.accountState, "PENDING");
    assert.equal(res.body.nextAction.kind, "PAY_ORDER");
    assert.equal(res.body.currentOrder.id, orderId);
  });

  test("proof upload validates the file and moves the order to review", async () => {
    const bad = new FormData();
    bad.append("paymentProof", new File([new TextEncoder().encode("not an image")], "x.png", { type: "image/png" }));
    const rejected = await call(orderProof.POST, request(`/api/mobile/orders/${orderId}/proof`, { token: customer.token, form: bad }), { id: String(orderId) });
    assert.equal(rejected.status, 400);

    const form = new FormData();
    form.append("paymentProof", new File([PNG], "proof.png", { type: "image/png" }));
    form.append("paymentReference", "TX-778899");
    const res = await call(orderProof.POST, request(`/api/mobile/orders/${orderId}/proof`, { token: customer.token, form }), { id: String(orderId) });
    assert.equal(res.status, 200);
    assert.equal(res.body.order.stage, "UNDER_REVIEW");
    assert.equal(res.body.order.paymentReference, "TX-778899");
    assert.ok(res.body.order.events.some((event: Json) => event.action === "PAYMENT_PROOF_UPLOADED"));

    const image = await orderProof.GET(request(`/api/mobile/orders/${orderId}/proof`, { token: customer.token }), { params: Promise.resolve({ id: String(orderId) }) });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
  });

  test("staff status change creates an in-app notification and pushes it to the phone", async () => {
    await call(devices.POST, request("/api/mobile/devices", { token: customer.token, body: { token: pushToken, platform: "ANDROID", deviceName: "Pixel", appVersion: "1.0.0" } }));
    const before = sent.length;

    const result = await updateOrderStatus(staff, orderId, "PAID");
    assert.ok(result.ok);

    const pushes = sent.slice(before).filter((message) => message.to === pushToken);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].data.link, `/orders/${orderId}`);

    const list = await call(notifications.GET, request("/api/mobile/notifications", { token: customer.token }));
    const item = list.body.notifications.find((entry: Json) => entry.id === pushes[0].data.notificationId);
    assert.deepEqual(item.destination, { kind: "ORDER", id: orderId });
    assert.equal(item.readAt, null);

    const detail = await call(orderDetail.GET, request(`/api/mobile/orders/${orderId}`, { token: customer.token }), { id: String(orderId) });
    assert.equal(detail.body.order.stage, "PAID");
    assert.equal(detail.body.order.canCancel, false);
  });

  test("paid orders cannot be cancelled; unpaid ones can", async () => {
    const paid = await call(orderCancel.POST, request(`/api/mobile/orders/${orderId}/cancel`, { token: customer.token, body: {} }), { id: String(orderId) });
    assert.equal(paid.status, 400);

    const created = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "RENEW", planSlug: plan.slug } }));
    const id = created.body.order.id;
    const cancelled = await call(orderCancel.POST, request(`/api/mobile/orders/${id}/cancel`, { token: customer.token, body: {} }), { id: String(id) });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.order.status, "CANCELLED");
  });

  test("subscriptions come from the backend with derived state", async () => {
    const expiry = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await db.orm.public.Subscription.create({
      userId: customer.id,
      packageName: `IT Plan ${RUN}`,
      packageId: plan.id,
      startDate: new Date().toISOString(),
      expiryDate: expiry,
      status: "ACTIVE",
    });
    const res = await call(subscriptions.GET, request("/api/mobile/subscriptions", { token: customer.token }));
    assert.equal(res.body.subscriptions[0].state, "EXPIRING");
    assert.equal(res.body.subscriptions[0].canRenew, true);
    // Lists never carry login credentials.
    assert.equal(res.body.subscriptions[0].credentials, null);
    assert.equal(res.body.subscriptions[0].password, undefined);
  });
});

describe("support", () => {
  test("ticket create, reply and close through the website ticket service", async () => {
    const created = await call(tickets.POST, request("/api/mobile/support/tickets", {
      token: customer.token,
      body: { subject: "مشكلة بالتشغيل", category: "playback", message: "القنوات تقطع", diagnostics: { appVersion: "1.0.0", os: "Android 14", device: "Pixel 7" } },
    }));
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;
    assert.match(created.body.ticket.context.app, /Shashtna Mobile/);

    const replied = await call(ticket.POST, request(`/api/mobile/support/tickets/${id}`, { token: customer.token, body: { message: "تفاصيل إضافية" } }), { id });
    assert.equal(replied.body.ticket.messages.length, 2);

    const closed = await call(ticket.POST, request(`/api/mobile/support/tickets/${id}`, { token: customer.token, body: { action: "close" } }), { id });
    assert.equal(closed.body.ticket.status, "CLOSED");

    const list = await call(tickets.GET, request("/api/mobile/support/tickets", { token: customer.token }));
    assert.ok(list.body.tickets.some((item: Json) => item.id === id));
  });
});

describe("acceptance 1 — announcement lifecycle is shared by website and mobile", () => {
  let id: number;

  test("admin creates → website shows → mobile API returns it", async () => {
    const row = await db.orm.public.Announcement.create({
      kind: "ANNOUNCEMENT",
      title: `صيانة مجدولة ${RUN}`,
      description: "الخدمة تتوقف ساعة",
      target: "ALL",
      placement: "DASHBOARD",
      isActive: true,
    });
    id = row.id;

    const website = await getLiveAnnouncements("WEBSITE");
    assert.ok(website.some((item) => item.id === id));
    const websiteApi = await call(websiteAnnouncements.GET, request("/api/announcements"));
    assert.ok(websiteApi.body.announcements.some((item: Json) => item.id === id));

    const mobile = await call(content.GET, request("/api/mobile/content"));
    assert.ok(mobile.body.announcements.some((item: Json) => item.id === id && item.title === `صيانة مجدولة ${RUN}`));
  });

  test("admin edits → mobile receives the updated record", async () => {
    await db.orm.public.Announcement.where({ id }).update({ title: `صيانة معدلة ${RUN}` });
    const detail = await call(contentItem.GET, request(`/api/mobile/content/${id}`), { id: String(id) });
    assert.equal(detail.body.item.title, `صيانة معدلة ${RUN}`);
  });

  test("admin expires it → gone from both", async () => {
    await db.orm.public.Announcement.where({ id }).update({ endsAt: new Date(Date.now() - 60_000).toISOString() });
    assert.ok(!(await getLiveAnnouncements("WEBSITE")).some((item) => item.id === id));
    const mobile = await call(content.GET, request("/api/mobile/content"));
    assert.ok(!mobile.body.announcements.some((item: Json) => item.id === id));
    assert.equal((await call(contentItem.GET, request(`/api/mobile/content/${id}`), { id: String(id) })).status, 404);
  });

  test("admin removes it → 404 on mobile", async () => {
    await db.orm.public.Announcement.where({ id }).delete();
    assert.equal((await call(contentItem.GET, request(`/api/mobile/content/${id}`), { id: String(id) })).status, 404);
  });

  test("website-only announcements never reach the app", async () => {
    const row = await db.orm.public.Announcement.create({ kind: "ANNOUNCEMENT", title: `Web only ${RUN}`, target: "WEBSITE", isActive: true });
    const mobile = await call(content.GET, request("/api/mobile/content"));
    assert.ok(!mobile.body.announcements.some((item: Json) => item.id === row.id));
  });
});

describe("acceptance 2 — offers", () => {
  test("admin creates and updates an offer; mobile reflects both", async () => {
    const row = await db.orm.public.Announcement.create({
      kind: "AD",
      title: `خصم ${RUN}`,
      description: "20٪",
      ctaLabel: "اشترك",
      ctaUrl: `/checkout?plan=${plan.slug}`,
      target: "MOBILE",
      isActive: true,
    });

    let mobile = await call(content.GET, request("/api/mobile/content"));
    let offer = mobile.body.offers.find((item: Json) => item.id === row.id);
    assert.ok(offer);
    assert.deepEqual(offer.cta.destination, { kind: "PLAN", slug: plan.slug });
    assert.equal(offer.cta.externalUrl, null);
    // MOBILE-only offers are not on the website.
    assert.ok(!(await getLiveAnnouncements("WEBSITE")).some((item) => item.id === row.id));

    await db.orm.public.Announcement.where({ id: row.id }).update({ description: "30٪", target: "ALL" });
    mobile = await call(content.GET, request("/api/mobile/content"));
    offer = mobile.body.offers.find((item: Json) => item.id === row.id);
    assert.equal(offer.description, "30٪");
    assert.ok((await getLiveAnnouncements("WEBSITE")).some((item) => item.id === row.id));

    await db.orm.public.Announcement.where({ id: row.id }).update({ isActive: false });
    mobile = await call(content.GET, request("/api/mobile/content"));
    assert.ok(!mobile.body.offers.some((item: Json) => item.id === row.id));
  });
});

describe("acceptance 3 — admin push to a phone", () => {
  test("targeted campaign → device resolved → push sent → notification centre → destination", async () => {
    const before = sent.length;
    const result = await createCampaign(staff, {
      title: "عرض خاص إلك",
      body: "افتح الطلب",
      type: "MESSAGE",
      audience: "CUSTOMER",
      customerPhone: customer.phone,
      destinationKind: "SUBSCRIPTIONS",
      mode: "now",
    });
    assert.ok(result.ok, JSON.stringify(result));

    const pushes = sent.slice(before);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].to, pushToken);
    assert.equal(pushes[0].title, "عرض خاص إلك");
    assert.equal(pushes[0].data.link, "/subscriptions");

    const list = await call(notifications.GET, request("/api/mobile/notifications", { token: customer.token }));
    const item = list.body.notifications.find((entry: Json) => entry.id === pushes[0].data.notificationId);
    assert.ok(item);
    assert.deepEqual(item.destination, { kind: "SUBSCRIPTIONS" });

    const unreadBefore = list.body.unread;
    const read = await call(notificationsRead.POST, request("/api/mobile/notifications/read", { token: customer.token, body: { id: item.id } }));
    assert.equal(read.body.unread, unreadBefore - 1);

    const campaign = await db.orm.public.PushCampaign.where({ title: "عرض خاص إلك" }).orderBy((row) => row.id.desc()).first();
    assert.equal(campaign?.status, "SENT");
    assert.equal(campaign?.recipientCount, 1);
    assert.equal(campaign?.acceptedCount, 1);

    // Sending the same campaign twice is impossible.
    assert.equal((await sendCampaign(staff, campaign!.id)).ok, false);
  });

  test("personal destinations must belong to the targeted customer", async () => {
    const res = await createCampaign(staff, {
      title: "x",
      body: "y",
      type: "ORDER_STATUS",
      audience: "CUSTOMER",
      customerPhone: `0771${DIGITS}`,
      destinationKind: "ORDER",
      destinationParam: "999999",
      mode: "now",
    });
    assert.equal(res.ok, false);
  });

  test("support staff cannot broadcast", async () => {
    const res = await createCampaign({ id: staff.id, role: "SUPPORT" }, { title: "x", body: "y", type: "MESSAGE", audience: "ALL", mode: "now" });
    assert.equal(res.ok, false);
  });

  test("scheduled campaigns wait, can be cancelled, and are dispatched when due", async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const scheduled = await createCampaign(staff, { title: `sched ${RUN}`, body: "b", type: "MESSAGE", audience: "CUSTOMER", customerPhone: customer.phone, mode: "schedule", scheduledAt: future });
    assert.ok(scheduled.ok);
    const id = (scheduled as Json).campaign.id;

    assert.ok(!(await dispatchDueCampaigns()).some((item) => item.id === id));
    const dispatched = await dispatchDueCampaigns(Date.now() + 11 * 60_000);
    assert.ok(dispatched.some((item) => item.id === id && item.ok));

    const second = await createCampaign(staff, { title: `cancel ${RUN}`, body: "b", type: "MESSAGE", audience: "CUSTOMER", customerPhone: customer.phone, mode: "schedule", scheduledAt: future });
    const secondId = (second as Json).campaign.id;
    assert.ok((await cancelCampaign(staff, secondId)).ok);
    assert.ok(!(await dispatchDueCampaigns(Date.now() + 11 * 60_000)).some((item) => item.id === secondId));
  });

  test("logout deactivates the device; no more pushes reach it", async () => {
    await call(devices.DELETE, request("/api/mobile/devices", { method: "DELETE", token: customer.token, body: { token: pushToken } }));
    const before = sent.length;
    await createCampaign(staff, { title: "after logout", body: "b", type: "MESSAGE", audience: "CUSTOMER", customerPhone: customer.phone, mode: "now" });
    assert.equal(sent.slice(before).filter((message) => message.to === pushToken).length, 0);
  });

  test("a token rejected by the provider is deactivated", async () => {
    await call(devices.POST, request("/api/mobile/devices", { token: customer.token, body: { token: pushToken, platform: "ANDROID" } }));
    setPushTransport(async () => ({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }));
    await createCampaign(staff, { title: "dead token", body: "b", type: "MESSAGE", audience: "CUSTOMER", customerPhone: customer.phone, mode: "now" });
    const device = await db.orm.public.PushDevice.first({ token: pushToken });
    assert.equal(device?.isActive, false);
    assert.equal(device?.lastError, "DeviceNotRegistered");
  });

  test("invalid push tokens are refused", async () => {
    const res = await call(devices.POST, request("/api/mobile/devices", { token: customer.token, body: { token: "hello", platform: "ANDROID" } }));
    assert.equal(res.status, 400);
  });
});

describe("service status", () => {
  test("mobile status uses the website incident records", async () => {
    const row = await db.orm.public.ServiceIncident.create({ title: `Outage ${RUN}`, message: "IPTV down", status: "OUTAGE", component: "IPTV", isPublished: true });
    let res = await call(status.GET, request("/api/mobile/status"));
    assert.equal(res.body.overall, "OUTAGE");
    assert.ok(res.body.active.some((item: Json) => item.id === row.id));

    await db.orm.public.ServiceIncident.where({ id: row.id }).update({ resolvedAt: new Date().toISOString() });
    res = await call(status.GET, request("/api/mobile/status"));
    assert.ok(!res.body.active.some((item: Json) => item.id === row.id));
    assert.ok(res.body.resolved.some((item: Json) => item.id === row.id && item.status === "RESOLVED"));
  });
});

// ---------------------------------------------------------------- round 2

const checkout = await import("@/app/api/mobile/checkout/route");
const logoutAll = await import("@/app/api/mobile/auth/logout-all/route");
const mePassword = await import("@/app/api/mobile/me/password/route");
const { attemptLogin, MAX_FAILURES } = await import("@/src/server/login-guard");

describe("checkout parity with the website", () => {
  test("resolves ONE package with the site's contact options and the saved preference", async () => {
    const res = await call(checkout.GET, request(`/api/mobile/checkout?plan=${plan.slug}`, { token: customer.token }));
    assert.equal(res.status, 200);
    assert.equal(res.body.mode, "NEW");
    assert.equal(res.body.plan.slug, plan.slug);
    assert.ok(res.body.contactOptions.includes("PHONE"));
    // The customer saved WHATSAPP earlier; it's offered only if the site has a WhatsApp number.
    assert.ok(res.body.contactOptions.includes(res.body.initialContact));
    assert.equal(res.body.customer.phone, customer.phone);
  });

  test("an unknown or disabled package cannot be confirmed", async () => {
    const res = await call(checkout.GET, request("/api/mobile/checkout?plan=does-not-exist", { token: customer.token }));
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "UNAVAILABLE");
  });

  test("the order stores the chosen contact method and manual transfer, and the dashboard highlights it with payment details", async () => {
    const created = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "UPGRADE", planSlug: plan.slug, subscriptionId: 999999, contactMethod: "PHONE" } }));
    // Upgrading a subscription that isn't yours is refused by the order service.
    assert.equal(created.status, 404);

    const sub = (await call(subscriptions.GET, request("/api/mobile/subscriptions", { token: customer.token }))).body.subscriptions[0];
    const ok = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "RENEW", planSlug: plan.slug, subscriptionId: sub.id, contactMethod: "PHONE", customerNote: "بعد العصر" } }));
    assert.ok(ok.status === 201 || ok.status === 200);
    const row = await db.orm.public.SubscriptionRequest.first({ id: ok.body.order.id });
    assert.equal(row?.contactMethod, "PHONE");
    assert.equal(row?.paymentMethod, "تحويل يدوي");
    assert.equal(row?.customerNote, "بعد العصر");

    const dash = await call(dashboard.GET, request(`/api/mobile/dashboard?order=${ok.body.order.id}`, { token: customer.token }));
    assert.equal(dash.body.currentOrder.id, ok.body.order.id);
    assert.deepEqual(dash.body.currentOrder.journey.map((step: Json) => step.key), ["SELECT", "PAY", "PROOF", "REVIEW"]);
    assert.ok(dash.body.currentOrder.payment.transfer.transferNumber);

    // Someone else's order id is ignored.
    const other = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Third", phone: `0772${DIGITS}`, password: "secret123", terms: true } }));
    const foreign = await call(dashboard.GET, request(`/api/mobile/dashboard?order=${ok.body.order.id}`, { token: other.body.token }));
    assert.equal(foreign.body.currentOrder, null);
  });
});

describe("TEST C / D at the API boundary — order update and payment", () => {
  test("customer order → proof stored privately → still unpaid → staff marks paid → activation", async () => {
    const created = await call(orders.POST, request("/api/mobile/orders", { token: customer.token, body: { requestType: "NEW", planSlug: plan.slug, contactMethod: "PHONE" } }));
    const id = created.body.order.id;

    const form = new FormData();
    form.append("paymentProof", new File([PNG], "p.png", { type: "image/png" }));
    form.append("paymentReference", "REF-D-1");
    const proof = await call(orderProof.POST, request(`/api/mobile/orders/${id}/proof`, { token: customer.token, form }), { id: String(id) });
    assert.equal(proof.body.order.stage, "UNDER_REVIEW");
    // Uploading never marks the order paid.
    assert.equal(proof.body.order.status, "SUBMITTED");
    // Stored outside public/.
    const { readPaymentProof } = await import("@/src/server/payment-proofs");
    assert.ok(await readPaymentProof(id));

    assert.ok((await updateOrderStatus(staff, id, "PAID")).ok);
    let detail = await call(orderDetail.GET, request(`/api/mobile/orders/${id}`, { token: customer.token }), { id: String(id) });
    assert.equal(detail.body.order.stage, "PAID");

    const { completeOrderWithSubscription } = await import("@/src/server/orders");
    const sub = await db.orm.public.Subscription.create({
      userId: customer.id,
      packageName: `IT Plan ${RUN}`,
      packageId: plan.id,
      startDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      status: "ACTIVE",
      username: `u${RUN}`,
      password: "p",
    });
    await completeOrderWithSubscription(staff, id, sub.id, { price: 27000, durationMonths: 12, durationLabel: "1 Year", bonusYears: 0 });
    detail = await call(orderDetail.GET, request(`/api/mobile/orders/${id}`, { token: customer.token }), { id: String(id) });
    assert.equal(detail.body.order.stage, "ACTIVATED");
    assert.equal(detail.body.order.subscriptionId, sub.id);
  });
});

describe("security", () => {
  test(`login locks after ${MAX_FAILURES} wrong passwords, for known and unknown phones alike`, async () => {
    const phone = `0773${DIGITS}`;
    await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Lock Test", phone, password: "secret123", terms: true } }));

    for (let attempt = 0; attempt < MAX_FAILURES; attempt += 1) {
      assert.equal((await call(login.POST, request("/api/mobile/auth/login", { body: { phone, password: "wrong" } }))).body.code, "INVALID_CREDENTIALS");
    }

    const locked = await call(login.POST, request("/api/mobile/auth/login", { body: { phone, password: "secret123" } }));
    assert.equal(locked.status, 429);
    assert.equal(locked.body.code, "LOCKED");

    // After the lock window the right password works again.
    assert.equal((await attemptLogin(phone, "secret123", Date.now() + 16 * 60_000)).ok, true);

    const ghost = `0774${DIGITS}`;
    for (let attempt = 0; attempt < MAX_FAILURES; attempt += 1) await attemptLogin(ghost, "x");
    const ghostResult = await attemptLogin(ghost, "x");
    assert.equal(ghostResult.ok, false);
    assert.equal(!ghostResult.ok && ghostResult.code, "LOCKED");
  });

  test("changing the password revokes other sessions and stops pushes to other phones; this device gets a new token", async () => {
    const phone = `0775${DIGITS}`;
    const reg = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Revoke", phone, password: "secret123", terms: true } }));
    const other = await call(login.POST, request("/api/mobile/auth/login", { body: { phone, password: "secret123" } }));
    const tokenB = `ExponentPushToken[revokeB${DIGITS}abcd]`;
    await call(devices.POST, request("/api/mobile/devices", { token: other.body.token, body: { token: tokenB, platform: "ANDROID" } }));

    const changed = await call(mePassword.POST, request("/api/mobile/me/password", { token: reg.body.token, body: { currentPassword: "secret123", newPassword: "secret456" } }));
    assert.equal(changed.status, 200);
    assert.ok(changed.body.token);

    assert.equal((await call(me.GET, request("/api/mobile/me", { token: other.body.token }))).status, 401);
    assert.equal((await call(me.GET, request("/api/mobile/me", { token: reg.body.token }))).status, 401);
    assert.equal((await call(me.GET, request("/api/mobile/me", { token: changed.body.token }))).status, 200);
    assert.equal((await db.orm.public.PushDevice.first({ token: tokenB }))?.isActive, false);
  });

  test("sign out on all devices", async () => {
    const phone = `0776${DIGITS}`;
    const reg = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "All", phone, password: "secret123", terms: true } }));
    assert.equal((await call(logoutAll.POST, request("/api/mobile/auth/logout-all", { token: reg.body.token, body: {} }))).status, 200);
    assert.equal((await call(me.GET, request("/api/mobile/me", { token: reg.body.token }))).status, 401);
  });
});

describe("multiple phones on one account", () => {
  test("phone A and phone B both stay registered and both receive the push", async () => {
    setPushTransport(async (url, body) => {
      if (url.endsWith("/send")) {
        const messages = body as typeof sent;
        sent.push(...messages);
        return { data: messages.map((_, index) => ({ status: "ok", id: `multi-${RUN}-${sent.length}-${index}` })) };
      }
      return { data: {} };
    });

    const phone = `0777${DIGITS}`;
    const a = await call(register.POST, request("/api/mobile/auth/register", { body: { name: "Two Phones", phone, password: "secret123", terms: true } }));
    const b = await call(login.POST, request("/api/mobile/auth/login", { body: { phone, password: "secret123" } }));
    const tokenA = `ExponentPushToken[phoneA${DIGITS}abcd]`;
    const tokenB = `ExponentPushToken[phoneB${DIGITS}abcd]`;
    await call(devices.POST, request("/api/mobile/devices", { token: a.body.token, body: { token: tokenA, platform: "ANDROID", deviceName: "A" } }));
    await call(devices.POST, request("/api/mobile/devices", { token: b.body.token, body: { token: tokenB, platform: "IOS", deviceName: "B" } }));

    const before = sent.length;
    const result = await createCampaign(staff, { title: "للجهازين", body: "b", type: "MESSAGE", audience: "CUSTOMER", customerPhone: phone, mode: "now" });
    assert.ok(result.ok);
    const targets = sent.slice(before).map((message) => message.to).sort();
    assert.deepEqual(targets, [tokenA, tokenB].sort());
  });
});
