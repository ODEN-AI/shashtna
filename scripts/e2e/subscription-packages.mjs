#!/usr/bin/env node
/**
 * End-to-end check of admin-managed subscription packages against a running
 * build and a LOCAL database (refuses any non-local DATABASE_URL):
 *
 *   set -a; . ./.env.local; set +a
 *   npm run build && npx next start -p 3300 &
 *   node scripts/e2e/subscription-packages.mjs
 *
 * It creates throwaway customers, a staff account, one test package and their
 * orders/subscriptions, and removes them at the end. It never prints tokens,
 * passwords or connection strings.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3300";
const DB = process.env.DATABASE_URL ?? "";

if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(DB)) {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(2);
}

const RUN = Date.now().toString().slice(-7);
const IP = `10.88.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
const sql = (query) => execFileSync("psql", [DB, "-Atc", query], { encoding: "utf8" }).trim();
const results = [];

async function call(method, path, { token, body } = {}) {
  const headers = { Accept: "application/json", "X-Forwarded-For": IP };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = response.headers.get("content-type") ?? "";
  return { status: response.status, data: type.includes("json") ? await response.json() : await response.text() };
}

async function check(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (error) {
    results.push(["FAIL", name, String(error?.message ?? error).split("\n")[0]]);
  }
}

function addMonths(dateOnly, months) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const month = index % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const today = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
})();

const password = `Pw-${RUN}-ok`;
const phones = { customer: `0793${RUN}`, staff: `0794${RUN}` };
// Canonical IPTV packages after the migrations (12 / 24 months reuse the legacy rows).
const SEEDED = [
  { slug: "iptv-3m", months: 3, price: 6000 },
  { slug: "iptv-6m", months: 6, price: 10000 },
  { slug: "iptv-1y", months: 12, price: 15000 },
  { slug: "iptv-2y", months: 24, price: 25000 },
];
const VIP_RENEWAL_PRICE = 35000;
let vipRenewalRestore = null;
const testSlug = `e2e-${RUN}-9m`;
let customer, staff, customerId, testPackageId;
const orders = {};
const subscriptions = {};

async function register(phone, name) {
  const r = await call("POST", "/api/mobile/auth/register", { body: { name, phone, password, terms: true } });
  assert.equal(r.status, 201, `register ${r.status} ${r.data?.message ?? ""}`);
  return r.data.token;
}

try {
  // ------------------------------------------------------------ setup
  await check("setup: customer and staff accounts", async () => {
    customer = await register(phones.customer, "E2E Packages Customer");
    await register(phones.staff, "E2E Packages Staff");
    sql(`update "user" set role='ADMIN' where phone='${phones.staff}'`);
    const login = await call("POST", "/api/mobile/auth/login", { body: { phone: phones.staff, password } });
    assert.equal(login.status, 200, `staff login ${login.status}`);
    staff = login.data.token;
    customerId = Number(sql(`select id from "user" where phone='${phones.customer}'`));
  });

  await check("one active IPTV package per canonical duration, at the configured IQD price", async () => {
    for (const pkg of SEEDED) {
      const row = sql(`select price||'|'||"durationMonths"||'|'||"isActive"||'|'||"serviceType"||'|'||coalesce("renewalPrice"::text,'-') from package where slug='${pkg.slug}'`);
      assert.equal(row, `${pkg.price}|${pkg.months}|true|IPTV|-`, pkg.slug);
      assert.equal(sql(`select count(*) from package where "serviceType"='IPTV' and "isActive" and "durationMonths"=${pkg.months}`), "1", `no duplicate ${pkg.months}-month IPTV package`);
    }
    assert.equal(sql(`select "serviceType"||'|'||coalesce("renewalPrice"::text,'-') from package where slug='vip-3m'`), `VIP|${VIP_RENEWAL_PRICE}`, "VIP renewal price");
  });

  // ------------------------------------------------------------ admin API
  await check("admin package API is protected (401 anonymous, 403 customer)", async () => {
    assert.equal((await call("GET", "/api/admin/packages")).status, 401);
    assert.equal((await call("GET", "/api/admin/packages", { token: customer })).status, 403);
    assert.equal((await call("POST", "/api/admin/packages", { token: customer, body: { name: "x", slug: "x", price: 1, durationValue: 3, durationUnit: "MONTH" } })).status, 403);
  });

  await check("admin creates a package with duration value + unit and an Arabic label", async () => {
    const r = await call("POST", "/api/admin/packages", { token: staff, body: { name: `E2E 9 أشهر ${RUN}`, slug: testSlug, serviceType: "IPTV", price: 12000, durationValue: 9, durationUnit: "MONTH", description: "", isActive: true } });
    assert.equal(r.status, 201, r.data?.message);
    assert.equal(r.data.message, "تم إنشاء الباقة بنجاح.");
    assert.equal(r.data.package.durationMonths, 9);
    assert.equal(r.data.package.durationUnit, "MONTH");
    assert.equal(r.data.package.durationLabel, "9 أشهر");
    testPackageId = r.data.package.id;
  });

  await check("admin input validation rejects invalid durations and prices with a message", async () => {
    const base = { name: "Bad", serviceType: "IPTV", price: 5000, durationValue: 3, durationUnit: "MONTH" };
    const bad = [
      { durationValue: 0 },
      { durationValue: -3 },
      { durationValue: 1.5 },
      { durationValue: "6" },
      { durationValue: 61 },
      { durationValue: 6, durationUnit: "YEAR" },
      { durationUnit: "DAY" },
      { price: -100 },
      { price: "5000" },
      { price: 99.5 },
    ];
    for (const [i, patch] of bad.entries()) {
      const r = await call("POST", "/api/admin/packages", { token: staff, body: { ...base, slug: `e2e-${RUN}-bad-${i}`, ...patch } });
      assert.equal(r.status, 400, `${JSON.stringify(patch)} → ${r.status}`);
      assert.ok(r.data.message, "message returned");
    }
    assert.equal(sql(`select count(*) from package where slug like 'e2e-${RUN}-bad-%'`), "0");
  });

  await check("admin edits price and duration (years); success message", async () => {
    const r = await call("PATCH", `/api/admin/packages/${testPackageId}`, { token: staff, body: { price: 13000, durationValue: 1, durationUnit: "YEAR", durationLabel: "" } });
    assert.equal(r.status, 200, r.data?.message);
    assert.ok(r.data.message);
    assert.equal(sql(`select price||'|'||"durationMonths"||'|'||"durationUnit"||'|'||"durationLabel" from package where id=${testPackageId}`), "13000|12|YEAR|سنة واحدة");
    const invalid = await call("PATCH", `/api/admin/packages/${testPackageId}`, { token: staff, body: { durationValue: 0, durationUnit: "MONTH" } });
    assert.equal(invalid.status, 400);
    assert.equal(sql(`select "durationMonths" from package where id=${testPackageId}`), "12", "a rejected edit changes nothing");
  });

  await check("disable keeps the duration; disabled package is hidden from customers", async () => {
    const r = await call("PATCH", `/api/admin/packages/${testPackageId}`, { token: staff, body: { isActive: false } });
    assert.equal(r.status, 200);
    assert.equal(sql(`select "isActive"||'|'||"durationMonths"||'|'||price from package where id=${testPackageId}`), "false|12|13000");
    const catalog = await call("GET", "/api/mobile/catalog");
    const slugs = catalog.data.packages.map((p) => p.slug);
    assert.ok(!slugs.includes(testSlug), "disabled hidden in app catalogue");
    for (const pkg of SEEDED) assert.ok(slugs.includes(pkg.slug), `${pkg.slug} shown`);
    const plans = await call("GET", "/plans");
    assert.ok(!plans.data.includes(testSlug), "disabled hidden on /plans");
    for (const pkg of SEEDED) assert.ok(plans.data.includes(`plan=${pkg.slug}`), `/plans links ${pkg.slug}`);
    assert.ok(plans.data.includes("6,000") || plans.data.includes("٦٬٠٠٠"), "3-month price shown");
  });

  await check("a disabled or nonexistent package cannot be purchased", async () => {
    const disabled = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: testSlug } });
    assert.ok(disabled.status >= 400 && disabled.status < 500, `disabled → ${disabled.status}`);
    const missing = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: `nope-${RUN}` } });
    assert.ok(missing.status >= 400 && missing.status < 500, `missing → ${missing.status}`);
    assert.equal(sql(`select count(*) from "subscriptionRequest" where "userId"=${customerId}`), "0");
  });

  await check("re-enabling makes it purchasable again (no redeploy)", async () => {
    assert.equal((await call("PATCH", `/api/admin/packages/${testPackageId}`, { token: staff, body: { isActive: true } })).status, 200);
    const catalog = await call("GET", "/api/mobile/catalog");
    assert.ok(catalog.data.packages.some((p) => p.slug === testSlug && p.price === 13000 && p.durationMonths === 12));
  });

  // ------------------------------------------------------------ customer orders
  await check("ordering each seeded package snapshots the DB price and duration (client price ignored)", async () => {
    for (const pkg of SEEDED) {
      const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: pkg.slug, price: 1, total: 1, durationMonths: 99 } });
      assert.equal(r.status, 201, `${pkg.slug} ${r.status} ${r.data?.error?.message ?? r.data?.message ?? ""}`);
      const id = r.data.order.id;
      orders[pkg.slug] = id;
      assert.equal(sql(`select price||'|'||"durationMonths"||'|'||status||'|'||coalesce("subscriptionId"::text,'-') from "subscriptionRequest" where id=${id}`), `${pkg.price}|${pkg.months}|SUBMITTED|-`, pkg.slug);
    }
    assert.equal(sql(`select count(*) from subscription where "userId"=${customerId}`), "0", "creating orders activates nothing");
  });

  await check("historical order keeps its price and duration after the package is edited", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: testSlug } });
    assert.equal(r.status, 201);
    orders.test = r.data.order.id;
    assert.equal((await call("PATCH", `/api/admin/packages/${testPackageId}`, { token: staff, body: { price: 99000, durationValue: 2, durationUnit: "YEAR" } })).status, 200);
    assert.equal(sql(`select price||'|'||"durationMonths"||'|'||"durationLabel" from "subscriptionRequest" where id=${orders.test}`), "13000|12|سنة واحدة");
    const list = await call("GET", "/api/mobile/orders", { token: customer });
    assert.equal(list.status, 200);
    const shown = JSON.stringify(list.data.orders.find((o) => o.id === orders.test));
    assert.ok(shown.includes("13000") && !shown.includes("99000"), "order history shows the original price");
  });

  // ------------------------------------------------------------ payment + activation
  async function confirmPayment(orderId) {
    const r = await call("PATCH", `/api/admin/subscription-requests/${orderId}`, { token: staff, body: { status: "PAID", paymentReference: `E2E-${RUN}` } });
    assert.equal(r.status, 200, `PAID ${r.status} ${r.data?.message ?? ""}`);
  }

  function activationBody(orderId, { serviceName, price, months, serviceType = "IPTV" }) {
    return {
      requestId: orderId,
      userId: customerId,
      serviceName,
      serviceType,
      username: `e2e${RUN}${orderId}`,
      password: `x${RUN}`,
      ...(serviceType === "VIP" ? { deviceId: `SN-${RUN}-${orderId}` } : {}),
      startDate: today,
      price,
      ...(months ? { durationMonths: months } : {}),
    };
  }

  async function activate(orderId, { serviceName, price, bogusMonths, serviceType }) {
    const r = await call("POST", "/api/admin/subscriptions", { token: staff, body: activationBody(orderId, { serviceName, price, months: bogusMonths, serviceType }) });
    assert.equal(r.status < 300, true, `activate ${r.status} ${r.data?.message ?? ""}`);
    return r.data;
  }

  await check("payment confirmation alone does not activate; approval activates the ordered duration", async () => {
    for (const pkg of SEEDED) {
      const id = orders[pkg.slug];
      await confirmPayment(id);
      assert.equal(sql(`select status||'|'||coalesce("subscriptionId"::text,'-') from "subscriptionRequest" where id=${id}`), "PAID|-");
      const serviceName = sql(`select "serviceName" from "subscriptionRequest" where id=${id}`);
      // A different duration in the request body must not override the order's snapshot.
      await activate(id, { serviceName, price: pkg.price, bogusMonths: 48 });
      const subId = Number(sql(`select "subscriptionId" from "subscriptionRequest" where id=${id}`));
      subscriptions[pkg.slug] = subId;
      assert.equal(sql(`select status from "subscriptionRequest" where id=${id}`), "COMPLETED");
      assert.equal(sql(`select to_char("expiryDate"::date,'YYYY-MM-DD')||'|'||status from subscription where id=${subId}`), `${addMonths(today, pkg.months)}|ACTIVE`, `${pkg.slug} expiry`);
      assert.equal(sql(`select price||'|'||"durationMonths" from receipt where "orderId"=${id}`), `${pkg.price}|${pkg.months}`, `${pkg.slug} receipt`);
    }
  });

  await check("renewal with a 6-month package extends the current expiry by 6 months", async () => {
    const target = subscriptions["iptv-3m"];
    const before = sql(`select to_char("expiryDate"::date,'YYYY-MM-DD') from subscription where id=${target}`);
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "iptv-6m", subscriptionId: target, price: 1 } });
    assert.equal(r.status, 201, `renew order ${r.status} ${r.data?.error?.message ?? ""}`);
    const id = r.data.order.id;
    assert.equal(sql(`select price||'|'||"durationMonths"||'|'||"requestType" from "subscriptionRequest" where id=${id}`), "10000|6|RENEW");
    await confirmPayment(id);
    await activate(id, { serviceName: "IPTV 6 أشهر", price: 10000 });
    assert.equal(sql(`select to_char("expiryDate"::date,'YYYY-MM-DD') from subscription where id=${target}`), addMonths(before, 6));
    assert.equal(sql(`select "durationMonths"||'|'||status||'|'||"subscriptionId" from "subscriptionRequest" where id=${id}`), `6|COMPLETED|${target}`);
    assert.equal(sql(`select "durationMonths" from receipt where "orderId"=${id}`), "6");
  });

  await check("invalid renewal length is refused by the server", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "iptv-3m", subscriptionId: subscriptions["iptv-1y"] } });
    assert.equal(r.status, 201);
    const id = r.data.order.id;
    const bad = await call("POST", "/api/admin/subscriptions", { token: staff, body: { requestId: id, userId: customerId, serviceName: "IPTV 3 أشهر", serviceType: "IPTV", startDate: today, price: 6000, durationMonths: 61 } });
    assert.equal(bad.status, 400);
    assert.equal(sql(`select status from "subscriptionRequest" where id=${id}`), "SUBMITTED");
  });

  // ------------------------------------------------------------ IPTV renewal price = normal price
  await check("IPTV renewal of the annual package costs 15,000 (no renewal price set)", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "iptv-1y", subscriptionId: subscriptions["iptv-1y"], price: 1 } });
    assert.equal(r.status, 201);
    assert.equal(sql(`select price||'|'||"durationMonths" from "subscriptionRequest" where id=${r.data.order.id}`), "15000|12");
  });

  // ------------------------------------------------------------ VIP vs IPTV never mix
  const vip = (() => {
    const [price, id] = sql(`select price||'|'||id from package where slug='vip-3m'`).split("|").map(Number);
    const [deviceId, devicePrice] = sql(`select d.id||'|'||d.price from device d join "packageDevice" pd on pd."deviceId"=d.id where pd."packageId"=${id} and d."isActive" order by d.id limit 1`).split("|").map(Number);
    return { price, id, deviceId, devicePrice };
  })();

  await check("a VIP renewal can't target an IPTV subscription (order refused)", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "vip-3m", subscriptionId: subscriptions["iptv-3m"] } });
    assert.equal(r.status, 400, `→ ${r.status}`);
  });

  await check("a VIP renewal without a VIP subscription never renews an IPTV one (activation refused)", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "vip-3m" } });
    assert.equal(r.status, 201);
    const id = r.data.order.id;
    const before = sql(`select string_agg(id||':'||"expiryDate", ',' order by id) from subscription where "userId"=${customerId}`);
    const bad = await call("POST", "/api/admin/subscriptions", { token: staff, body: activationBody(id, { serviceName: "VIP 3 أشهر", price: VIP_RENEWAL_PRICE, serviceType: "VIP" }) });
    assert.equal(bad.status, 400, `→ ${bad.status}`);
    assert.equal(sql(`select string_agg(id||':'||"expiryDate", ',' order by id) from subscription where "userId"=${customerId}`), before, "IPTV subscriptions unchanged");
    assert.equal(sql(`select status from "subscriptionRequest" where id=${id}`), "SUBMITTED");
    sql(`update "subscriptionRequest" set status='CANCELLED' where id=${id}`);
  });

  // ------------------------------------------------------------ VIP new + renewal
  await check("VIP new subscription: package + device price, 3 months", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: "vip-3m", deviceId: vip.deviceId, price: 1 } });
    assert.equal(r.status, 201, `${r.status} ${r.data?.error?.message ?? ""}`);
    const id = r.data.order.id;
    assert.equal(sql(`select price||'|'||"devicePrice"||'|'||"durationMonths" from "subscriptionRequest" where id=${id}`), `${vip.price + vip.devicePrice}|${vip.devicePrice}|3`);
    await confirmPayment(id);
    await activate(id, { serviceName: "VIP 3 أشهر", price: vip.price + vip.devicePrice, serviceType: "VIP" });
    subscriptions.vip = Number(sql(`select "subscriptionId" from "subscriptionRequest" where id=${id}`));
    assert.equal(sql(`select "serviceType"||'|'||to_char("expiryDate"::date,'YYYY-MM-DD') from subscription where id=${subscriptions.vip}`), `VIP|${addMonths(today, 3)}`);
  });

  await check("catalogue and checkout show the VIP renewal price (website + app)", async () => {
    const catalog = await call("GET", "/api/mobile/catalog");
    const byslug = Object.fromEntries(catalog.data.packages.map((p) => [p.slug, p]));
    assert.equal(byslug["vip-3m"].renewalPrice, VIP_RENEWAL_PRICE);
    assert.equal(byslug["vip-3m"].price, vip.price, "normal VIP price unchanged");
    assert.equal(byslug["iptv-1y"].renewalPrice, 15000, "IPTV renews at its normal price");
    const preview = await call("GET", `/api/mobile/checkout?renew=${subscriptions.vip}`, { token: customer });
    assert.equal(preview.status, 200, `${preview.status}`);
    assert.equal(preview.data.plan.slug, "vip-3m");
    assert.equal(preview.data.plan.price, VIP_RENEWAL_PRICE);
    assert.equal(preview.data.plan.normalPrice, vip.price);
    const plans = await call("GET", "/plans");
    assert.ok(plans.data.includes("compare-renewal-price"), "/plans shows the renewal price");
  });

  await check("VIP renewal: 35,000, no device, exactly 3 months from the current expiry", async () => {
    const before = sql(`select to_char("expiryDate"::date,'YYYY-MM-DD') from subscription where id=${subscriptions.vip}`);
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "vip-3m", subscriptionId: subscriptions.vip, deviceId: vip.deviceId, price: 1 } });
    assert.equal(r.status, 201, `${r.status} ${r.data?.error?.message ?? ""}`);
    const id = r.data.order.id;
    orders.vipRenewal = id;
    assert.equal(sql(`select price||'|'||coalesce("devicePrice"::text,'-')||'|'||"durationMonths" from "subscriptionRequest" where id=${id}`), `${VIP_RENEWAL_PRICE}|-|3`);
    await confirmPayment(id);
    const year = await call("POST", "/api/admin/subscriptions", { token: staff, body: activationBody(id, { serviceName: "VIP 3 أشهر", price: VIP_RENEWAL_PRICE, months: 12, serviceType: "VIP" }) });
    assert.equal(year.status, 400, "a 12-month VIP renewal is refused");
    await activate(id, { serviceName: "VIP 3 أشهر", price: VIP_RENEWAL_PRICE, serviceType: "VIP" });
    assert.equal(sql(`select to_char("expiryDate"::date,'YYYY-MM-DD')||'|'||"serviceType" from subscription where id=${subscriptions.vip}`), `${addMonths(before, 3)}|VIP`);
    assert.equal(sql(`select price||'|'||"durationMonths"||'|'||"serviceType" from receipt where "orderId"=${id}`), `${VIP_RENEWAL_PRICE}|3|VIP`);
  });

  await check("admin changes the VIP renewal price from the dashboard API; only new orders use it", async () => {
    const invalid = await call("PATCH", `/api/admin/packages/${vip.id}`, { token: staff, body: { renewalPrice: -5 } });
    assert.equal(invalid.status, 400);
    vipRenewalRestore = VIP_RENEWAL_PRICE;
    const r = await call("PATCH", `/api/admin/packages/${vip.id}`, { token: staff, body: { renewalPrice: 36000 } });
    assert.equal(r.status, 200, r.data?.message);
    assert.equal(sql(`select price||'|'||"renewalPrice" from package where id=${vip.id}`), `${vip.price}|36000`, "normal price untouched");
    const order = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: "vip-3m", subscriptionId: subscriptions.vip } });
    assert.equal(order.status, 201);
    assert.equal(sql(`select price from "subscriptionRequest" where id=${order.data.order.id}`), "36000");
    assert.equal(sql(`select price from "subscriptionRequest" where id=${orders.vipRenewal}`), String(VIP_RENEWAL_PRICE), "earlier renewal keeps its price");
    assert.equal(sql(`select price from receipt where "orderId"=${orders.vipRenewal}`), String(VIP_RENEWAL_PRICE));
    assert.equal(sql(`select count(*) from "activityEvent" where "entityType"='PACKAGE' and "entityId"='${vip.id}' and action='PACKAGE_PRICE_CHANGED' and details like '%renewalPrice: 35000 → 36000%'`), "1", "audited");
  });
} finally {
  if (vipRenewalRestore !== null) {
    try { sql(`update package set "renewalPrice"=${vipRenewalRestore} where slug='vip-3m'`); } catch (error) { console.error("restore VIP renewal price failed:", String(error.message).split("\n")[0]); }
  }
  // ------------------------------------------------------------ cleanup (local rows of this run only)
  try {
    const ids = sql(`select string_agg(id::text, ',') from "user" where phone in ('${phones.customer}','${phones.staff}')`);
    if (ids) {
      sql(`delete from receipt where "userId" in (${ids})`);
      sql(`delete from "subscriptionRequest" where "userId" in (${ids})`);
      sql(`delete from subscription where "userId" in (${ids})`);
      for (const table of ["notification", "activityEvent"]) {
        try { sql(`delete from "${table}" where "userId" in (${ids})`); } catch { /* optional table */ }
      }
      try { sql(`delete from "activityEvent" where "actorUserId" in (${ids})`); } catch { /* optional */ }
      try { sql(`delete from "user" where id in (${ids})`); } catch (error) { console.error("cleanup: users kept:", String(error.message).split("\n")[0]); }
    }
    sql(`delete from package where slug like 'e2e-${RUN}-%'`);
  } catch (error) {
    console.error("cleanup failed:", String(error?.message ?? error).split("\n")[0]);
  }
}

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ""}`);
const failed = results.filter(([status]) => status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
