#!/usr/bin/env node
/**
 * End-to-end check of package options (one package, several lengths, each
 * with its own price) against a running server and a LOCAL database
 * (refuses any non-local DATABASE_URL):
 *
 *   set -a; . ./.env; set +a
 *   npm run dev            # or: npm run build && npx next start -p 3300
 *   BASE=http://127.0.0.1:3000 node scripts/e2e/package-options.mjs
 *
 * It creates throwaway customer and staff accounts, test packages and their
 * orders / subscriptions, and removes them at the end. It never prints
 * tokens, passwords or connection strings. SQL runs through `psql` when it is
 * installed, else through the `pg` driver already in node_modules.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const BASE = process.env.BASE ?? "http://127.0.0.1:3300";
const DB = process.env.DATABASE_URL ?? "";

if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(DB)) {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(2);
}

// ------------------------------------------------------------------ SQL
let pgClient = null;

function hasPsql() {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const usePsql = hasPsql();

/** One value per row, "|"-joined columns, like `psql -Atc`. */
async function sql(query) {
  if (usePsql) return execFileSync("psql", [DB, "-Atc", query], { encoding: "utf8" }).trim();

  if (!pgClient) {
    const { Client } = createRequire(import.meta.url)("pg");
    pgClient = new Client({ connectionString: DB });
    await pgClient.connect();
  }

  const result = await pgClient.query({ text: query, rowMode: "array" });
  return result.rows.map((row) => row.map((value) => (value === null ? "" : String(value))).join("|")).join("\n");
}

// ------------------------------------------------------------------ HTTP
const RUN = Date.now().toString().slice(-7);
const IP = `10.89.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
const results = [];

async function call(method, path, { token, body, redirect } = {}) {
  const headers = { Accept: "application/json", "X-Forwarded-For": IP };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, { method, headers, redirect: redirect ?? "follow", body: body === undefined ? undefined : JSON.stringify(body) });
  const type = response.headers.get("content-type") ?? "";
  return { status: response.status, location: response.headers.get("location"), data: type.includes("json") ? await response.json() : await response.text() };
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
const phones = { customer: `0795${RUN}`, staff: `0796${RUN}` };
const slug = `e2e-${RUN}-options`;
const otherSlug = `e2e-${RUN}-other`;
let customer, staff, customerId, packageId, otherPackageId;
const optionIds = {};
const orders = {};

async function register(phone, name) {
  const r = await call("POST", "/api/mobile/auth/register", { body: { name, phone, password, terms: true } });
  assert.equal(r.status, 201, `register ${r.status} ${r.data?.message ?? ""}`);
  return r.data.token;
}

async function optionRows(id) {
  return (await sql(`select "durationMonths"||':'||price||':'||coalesce("renewalPrice"::text,'-')||':'||"isActive" from "packageOption" where "packageId"=${id} order by "durationMonths"`)).split("\n").filter(Boolean);
}

async function loadOptionIds(id) {
  for (const row of (await sql(`select "durationMonths"||'|'||id from "packageOption" where "packageId"=${id} and "durationMonths" > 0`)).split("\n").filter(Boolean)) {
    const [months, optionId] = row.split("|").map(Number);
    optionIds[months] = optionId;
  }
}

const order = (body) => call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: slug, ...body } });

try {
  // ------------------------------------------------------------ setup
  await check("setup: customer and staff accounts", async () => {
    customer = await register(phones.customer, "E2E Options Customer");
    await register(phones.staff, "E2E Options Staff");
    await sql(`update "user" set role='ADMIN' where phone='${phones.staff}'`);
    const login = await call("POST", "/api/mobile/auth/login", { body: { phone: phones.staff, password } });
    assert.equal(login.status, 200, `staff login ${login.status}`);
    staff = login.data.token;
    customerId = Number(await sql(`select id from "user" where phone='${phones.customer}'`));
  });

  // ------------------------------------------------------------ admin: create
  await check("admin creates ONE package with four lengths, each with its own price (any supported length)", async () => {
    const r = await call("POST", "/api/admin/packages", {
      token: staff,
      body: {
        name: `E2E IPTV ${RUN}`,
        slug,
        serviceType: "IPTV",
        isActive: true,
        options: [
          { durationValue: 3, durationUnit: "MONTH", price: 7000 },
          { durationValue: 6, durationUnit: "MONTH", price: 12000, renewalPrice: 11000 },
          { durationValue: 1, durationUnit: "YEAR", price: 20000 },
          { durationValue: 18, durationUnit: "MONTH", price: 26000 },
        ],
      },
    });
    assert.equal(r.status, 201, r.data?.message);
    packageId = r.data.package.id;
    assert.deepEqual(await optionRows(packageId), ["3:7000:-:true", "6:12000:11000:true", "12:20000:-:true", "18:26000:-:true"]);
    assert.equal(await sql(`select price||'|'||"durationMonths" from package where id=${packageId}`), "7000|3", "the package mirrors its shortest length");
    assert.equal(await sql(`select count(*) from package where slug like 'e2e-${RUN}-options%'`), "1", "one package, not one per length");
    await loadOptionIds(packageId);
  });

  await check("admin input is validated on the server; a refused package is not created", async () => {
    const base = { name: "x", serviceType: "IPTV", isActive: true };
    const bad = [
      [{ durationValue: 12, durationUnit: "MONTH", price: 1 }, { durationValue: 1, durationUnit: "YEAR", price: 2 }],
      [{ durationValue: 3, durationUnit: "MONTH", price: 1, isActive: false }],
      [{ durationValue: 3, durationUnit: "MONTH", price: "7000" }],
      [{ durationValue: 0, durationUnit: "MONTH", price: 1 }],
      [{ durationValue: 6, durationUnit: "YEAR", price: 1 }],
      [],
    ];
    for (const [i, options] of bad.entries()) {
      const r = await call("POST", "/api/admin/packages", { token: staff, body: { ...base, slug: `e2e-${RUN}-bad-${i}`, options } });
      assert.equal(r.status, 400, `case ${i}: ${r.status}`);
    }
    const vip = await call("POST", "/api/admin/packages", { token: staff, body: { ...base, serviceType: "VIP", slug: `e2e-${RUN}-bad-vip`, options: [{ price: 1 }, { price: 2 }] } });
    assert.equal(vip.status, 400, "VIP keeps one three-month length");
    assert.equal(await sql(`select count(*) from package where slug like 'e2e-${RUN}-bad-%'`), "0");
    assert.equal((await call("POST", "/api/admin/packages", { token: customer, body: { ...base, slug: `e2e-${RUN}-bad-x`, options: [{ durationValue: 3, durationUnit: "MONTH", price: 1 }] } })).status, 403);
  });

  await check("admin edits lengths in the package form: change a price, remove one, add one", async () => {
    const r = await call("PATCH", `/api/admin/packages/${packageId}`, {
      token: staff,
      body: {
        options: [
          { id: optionIds[3], durationValue: 3, durationUnit: "MONTH", price: 7000 },
          { id: optionIds[6], durationValue: 6, durationUnit: "MONTH", price: 12500, renewalPrice: 11000 },
          { id: optionIds[12], durationValue: 1, durationUnit: "YEAR", price: 20000 },
          { durationValue: 2, durationUnit: "YEAR", price: 30000 },
        ],
      },
    });
    assert.equal(r.status, 200, r.data?.message);
    assert.deepEqual(await optionRows(packageId), ["3:7000:-:true", "6:12500:11000:true", "12:20000:-:true", "24:30000:-:true"], "18 months removed (no orders), 24 added");
    assert.equal(await sql(`select count(*) from "activityEvent" where "entityType"='PACKAGE' and "entityId"='${packageId}' and action='PACKAGE_OPTIONS_CHANGED'`), "1", "audited");
    await loadOptionIds(packageId);
  });

  await check("a stale form (option removed elsewhere) is refused and changes nothing", async () => {
    const r = await call("PATCH", `/api/admin/packages/${packageId}`, { token: staff, body: { name: "should not save", options: [{ id: 999999999, durationValue: 3, durationUnit: "MONTH", price: 1 }] } });
    assert.equal(r.status, 409);
    assert.notEqual(await sql(`select name from package where id=${packageId}`), "should not save");
    assert.deepEqual(await optionRows(packageId), ["3:7000:-:true", "6:12500:11000:true", "12:20000:-:true", "24:30000:-:true"]);
  });

  // ------------------------------------------------------------ customer side
  await check("catalogue shows the package once with every length and price", async () => {
    const r = await call("GET", "/api/mobile/catalog");
    assert.equal(r.status, 200);
    const pkg = r.data.packages.find((item) => item.slug === slug);
    assert.ok(pkg, "listed");
    assert.deepEqual(pkg.options.map((o) => `${o.durationMonths}:${o.price}`), ["3:7000", "6:12500", "12:20000", "24:30000"]);
    assert.equal(pkg.price, 7000, "older app builds still read the default length");
  });

  await check("plan page offers the lengths; checkout shows the chosen length and price", async () => {
    const page = await call("GET", `/plans/${slug}?option=${optionIds[12]}`);
    assert.equal(page.status, 200);
    assert.equal((page.data.match(/data-testid="plan-option"/g) ?? []).length, 4, "four lengths to choose from");
    assert.match(page.data, new RegExp(`href="/checkout\\?plan=${slug}&amp;option=${optionIds[12]}"`), "'Subscribe now' carries the chosen length");

    const checkout = await call("GET", `/checkout?plan=${slug}&option=${optionIds[6]}`);
    assert.equal(checkout.status, 200);
    assert.match(checkout.data, new RegExp(`name="optionId" value="${optionIds[6]}"`));
    assert.match(checkout.data, /12,500/);
    const preview = await call("GET", `/api/mobile/checkout?plan=${slug}&option=${optionIds[6]}`, { token: customer });
    assert.equal(preview.status, 200);
    assert.deepEqual([preview.data.plan.optionId, preview.data.plan.price, preview.data.plan.durationMonths], [optionIds[6], 12500, 6]);
  });

  await check("a stale or tampered length in the checkout link goes back to the plan, never to another length", async () => {
    for (const bad of ["999999999", "abc"]) {
      const r = await call("GET", `/checkout?plan=${slug}&option=${bad}`, { redirect: "manual" });
      assert.ok([303, 307, 308].includes(r.status), `option=${bad}: ${r.status}`);
      assert.match(r.location ?? "", new RegExp(`/plans/${slug}$`));
    }
  });

  // ------------------------------------------------------------ orders
  await check("the order is priced from the chosen length on the server; client price and duration are ignored", async () => {
    const r = await order({ optionId: optionIds[6], price: 1, total: 1, durationMonths: 99 });
    assert.equal(r.status, 201, r.data?.message);
    orders.six = r.data.order.id;
    assert.equal(await sql(`select price||'|'||"durationMonths"||'|'||"packageOptionId"||'|'||status from "subscriptionRequest" where id=${orders.six}`), `12500|6|${optionIds[6]}|SUBMITTED`);
  });

  await check("an option of another package, an unknown or malformed option is refused (no order)", async () => {
    const other = await call("POST", "/api/admin/packages", { token: staff, body: { name: `E2E other ${RUN}`, slug: otherSlug, serviceType: "IPTV", isActive: true, options: [{ durationValue: 9, durationUnit: "MONTH", price: 100 }] } });
    assert.equal(other.status, 201, other.data?.message);
    otherPackageId = other.data.package.id;
    const foreign = Number(await sql(`select id from "packageOption" where "packageId"=${otherPackageId}`));
    const before = await sql(`select count(*) from "subscriptionRequest" where "userId"=${customerId}`);

    for (const optionId of [foreign, 999999999, "abc", -1]) {
      const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: slug, optionId } });
      assert.equal(r.status, 400, `optionId ${optionId}: ${r.status}`);
    }
    assert.equal(await sql(`select count(*) from "subscriptionRequest" where "userId"=${customerId}`), before);
  });

  await check("older clients without a length get the default (shortest) one", async () => {
    const r = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "NEW", planSlug: otherSlug } });
    assert.equal(r.status, 201, r.data?.message);
    orders.legacy = r.data.order.id;
    assert.equal(await sql(`select price||'|'||"durationMonths" from "subscriptionRequest" where id=${orders.legacy}`), "100|9");
  });

  await check("activation gives the subscription the ordered length; a renewal uses that length's renewal price", async () => {
    const paid = await call("PATCH", `/api/admin/subscription-requests/${orders.six}`, { token: staff, body: { status: "PAID", paymentReference: `E2E-${RUN}` } });
    assert.equal(paid.status, 200, paid.data?.message);
    const serviceName = await sql(`select "serviceName" from "subscriptionRequest" where id=${orders.six}`);
    const act = await call("POST", "/api/admin/subscriptions", {
      token: staff,
      body: { requestId: orders.six, userId: customerId, serviceName, serviceType: "IPTV", username: `e2e${RUN}`, password: `x${RUN}`, startDate: today, price: 12500, durationMonths: 48 },
    });
    assert.ok(act.status < 300, `activate ${act.status} ${act.data?.message ?? ""}`);
    const sub = await sql(`select id||'|'||to_char("expiryDate", 'YYYY-MM-DD')||'|'||"packageId" from subscription where "userId"=${customerId}`);
    const [subId, expiry, linked] = sub.split("|");
    assert.equal(expiry, addMonths(today, 6), "6 months from activation (the order's length, not a value sent by staff)");
    assert.equal(Number(linked), packageId);

    const renew = await call("POST", "/api/mobile/orders", { token: customer, body: { requestType: "RENEW", planSlug: slug, optionId: optionIds[6], subscriptionId: Number(subId) } });
    assert.equal(renew.status, 201, renew.data?.message);
    orders.renew = renew.data.order.id;
    assert.equal(await sql(`select price||'|'||"durationMonths" from "subscriptionRequest" where id=${orders.renew}`), "11000|6");
  });

  await check("changing a length's price never changes past orders", async () => {
    const r = await call("PATCH", `/api/admin/packages/${packageId}`, {
      token: staff,
      body: {
        options: [
          { id: optionIds[3], durationValue: 3, durationUnit: "MONTH", price: 7000 },
          { id: optionIds[6], durationValue: 6, durationUnit: "MONTH", price: 13000, renewalPrice: 11000 },
          { id: optionIds[12], durationValue: 1, durationUnit: "YEAR", price: 20000 },
          { id: optionIds[24], durationValue: 2, durationUnit: "YEAR", price: 30000 },
        ],
      },
    });
    assert.equal(r.status, 200, r.data?.message);
    assert.equal(await sql(`select price from "subscriptionRequest" where id=${orders.six}`), "12500");
    assert.equal(await sql(`select price from receipt where "orderId"=${orders.six}`), "12500");
  });

  await check("removing a length that orders used keeps it (inactive) for their history; customers can't buy it", async () => {
    const r = await call("PATCH", `/api/admin/packages/${packageId}`, {
      token: staff,
      body: {
        options: [
          { id: optionIds[3], durationValue: 3, durationUnit: "MONTH", price: 7000 },
          { id: optionIds[12], durationValue: 1, durationUnit: "YEAR", price: 20000 },
          { id: optionIds[24], durationValue: 2, durationUnit: "YEAR", price: 30000 },
        ],
      },
    });
    assert.equal(r.status, 200, r.data?.message);
    assert.equal(await sql(`select "isActive"||'|'||("durationMonths" < 0) from "packageOption" where id=${optionIds[6]}`), "false|true", "kept, inactive, off the live lengths");
    assert.equal(await sql(`select "packageOptionId" from "subscriptionRequest" where id=${orders.six}`), String(optionIds[6]), "the order still points at it");
    const catalog = await call("GET", "/api/mobile/catalog");
    assert.deepEqual(catalog.data.packages.find((item) => item.slug === slug).options.map((o) => o.durationMonths), [3, 12, 24]);
    const buy = await order({ optionId: optionIds[6] });
    assert.equal(buy.status, 400);
  });

  await check("a removed length can be added again; the kept history row stays apart", async () => {
    const r = await call("PATCH", `/api/admin/packages/${packageId}`, {
      token: staff,
      body: {
        options: [
          { id: optionIds[3], durationValue: 3, durationUnit: "MONTH", price: 7000 },
          { durationValue: 6, durationUnit: "MONTH", price: 12000 },
          { id: optionIds[12], durationValue: 1, durationUnit: "YEAR", price: 20000 },
          { id: optionIds[24], durationValue: 2, durationUnit: "YEAR", price: 30000 },
        ],
      },
    });
    assert.equal(r.status, 200, r.data?.message);
    // The parked row has a negative length now, so a new one is made for 6 months: the history row stays parked.
    assert.equal(await sql(`select count(*) from "packageOption" where "packageId"=${packageId} and "durationMonths"=6 and "isActive"`), "1");
    await loadOptionIds(packageId);
  });

  await check("the old edit path (price / duration on the package) updates the default length", async () => {
    const r = await call("PATCH", `/api/admin/packages/${packageId}`, { token: staff, body: { price: 7500 } });
    assert.equal(r.status, 200, r.data?.message);
    assert.equal(await sql(`select price from "packageOption" where id=${optionIds[3]}`), "7500");
    assert.equal(await sql(`select price||'|'||"durationMonths" from package where id=${packageId}`), "7500|3");
    const clash = await call("PATCH", `/api/admin/packages/${packageId}`, { token: staff, body: { durationValue: 1, durationUnit: "YEAR" } });
    assert.equal(clash.status, 409, "it can't take a length another option already has");
    assert.equal(await sql(`select "durationMonths" from package where id=${packageId}`), "3", "the refused edit changed nothing");
  });

  await check("an inactive package is hidden and can't be ordered", async () => {
    assert.equal((await call("PATCH", `/api/admin/packages/${packageId}`, { token: staff, body: { isActive: false } })).status, 200);
    const catalog = await call("GET", "/api/mobile/catalog");
    assert.ok(!catalog.data.packages.some((item) => item.slug === slug));
    assert.equal((await call("GET", `/plans/${slug}`)).status, 404);
    const checkout = await call("GET", `/checkout?plan=${slug}&option=${optionIds[3]}`, { redirect: "manual" });
    assert.ok([303, 307, 308].includes(checkout.status), `checkout ${checkout.status}`);
    assert.equal((await order({ optionId: optionIds[3] })).status, 400);
  });
} finally {
  // ------------------------------------------------------------ cleanup (rows of this run only)
  try {
    const ids = await sql(`select string_agg(id::text, ',') from "user" where phone in ('${phones.customer}','${phones.staff}')`);
    if (ids) {
      await sql(`delete from receipt where "userId" in (${ids})`);
      await sql(`delete from "subscriptionRequest" where "userId" in (${ids})`);
      await sql(`delete from subscription where "userId" in (${ids})`);
      for (const table of ["notification", "activityEvent"]) {
        try { await sql(`delete from "${table}" where "userId" in (${ids})`); } catch { /* optional table */ }
      }
      try { await sql(`delete from "activityEvent" where "actorUserId" in (${ids})`); } catch { /* optional */ }
      try { await sql(`delete from "user" where id in (${ids})`); } catch (error) { console.error("cleanup: users kept:", String(error.message).split("\n")[0]); }
    }
    await sql(`delete from "packageOption" where "packageId" in (select id from package where slug like 'e2e-${RUN}-%')`);
    await sql(`delete from "activityEvent" where "entityType"='PACKAGE' and "entityId" in (select id::text from package where slug like 'e2e-${RUN}-%')`);
    await sql(`delete from package where slug like 'e2e-${RUN}-%'`);
  } catch (error) {
    console.error("cleanup failed:", String(error?.message ?? error).split("\n")[0]);
  }
  await pgClient?.end();
}

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ""}`);
const failed = results.filter(([status]) => status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
