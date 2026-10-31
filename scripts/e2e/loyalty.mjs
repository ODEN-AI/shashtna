#!/usr/bin/env node
/**
 * End-to-end check of «نقاط شاشتنا» (loyalty points) against a running server
 * and a LOCAL database (refuses any non-local DATABASE_URL):
 *
 *   set -a; . ./.env; set +a
 *   npm run build && npx next start -p 3300
 *   BASE=http://127.0.0.1:3300 node scripts/e2e/loyalty.mjs
 *
 * Earning on completion (once), redemption into a 0-price RENEW reward order,
 * two simultaneous redemptions, owner-only approval, return on rejection,
 * activation of an approved reward, expiry, the launch seed (twice), and
 * cross-customer / tampered requests. It creates throwaway accounts, a test
 * package and their rows, restores the loyalty settings and removes
 * everything at the end. It never prints tokens, passwords or connection strings.
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
const IP = `10.91.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
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
const phones = { a: `0781${RUN}`, b: `0782${RUN}`, admin: `0783${RUN}`, owner: `0784${RUN}` };
const slug = `e2e-${RUN}-loyalty`;
const tokens = {};
const ids = {};
const option = {};
const startedAt = new Date().toISOString();
let savedSettings = "";

async function register(phone, name) {
  const r = await call("POST", "/api/mobile/auth/register", { body: { name, phone, password, terms: true } });
  assert.equal(r.status, 201, `register ${r.status} ${r.data?.message ?? ""}`);
  return r.data.token;
}

async function login(phone) {
  const r = await call("POST", "/api/mobile/auth/login", { body: { phone, password } });
  assert.equal(r.status, 200, `login ${r.status}`);
  return r.data.token;
}

async function setSetting(key, value) {
  await sql(`insert into "siteSetting" (key, value, "updatedAt") values ('${key}', '${value}', now()) on conflict (key) do update set value = excluded.value, "updatedAt" = now()`);
}

const entries = (userId) => sql(`select string_agg(kind || ':' || points, ',' order by id) from "loyaltyEntry" where "userId" = ${userId}`);
const balance = async (userId) => Number((await sql(`select coalesce(balance, 0) from "loyaltyAccount" where "userId" = ${userId}`)) || 0);
const ledger = async (userId) => Number(await sql(`select coalesce(sum(points), 0) from "loyaltyEntry" where "userId" = ${userId}`));
const loyalty = async (token) => (await call("GET", "/api/mobile/loyalty", { token })).data.loyalty;

/** Staff path: PAID, then activate (create or renew) through the normal endpoint. */
async function payAndActivate(orderId, userId, price, extra = {}) {
  const paid = await call("PATCH", `/api/admin/subscription-requests/${orderId}`, { token: tokens.owner, body: { status: "PAID", paymentReference: `E2E-${RUN}` } });
  assert.equal(paid.status, 200, `paid ${paid.status} ${paid.data?.message ?? ""}`);
  return activate(orderId, userId, price, extra);
}

async function activate(orderId, userId, price, extra = {}, token = tokens.admin) {
  return call("POST", "/api/admin/subscriptions", {
    token,
    body: { requestId: orderId, userId, serviceName: `E2E Loyalty ${RUN}`, serviceType: "IPTV", username: `e2el${RUN}${orderId}`, password: `x${RUN}`, startDate: today, price, ...extra },
  });
}

try {
  // ------------------------------------------------------------ setup
  await check("setup: two customers, a staff operator and the owner; an IPTV package with two lengths", async () => {
    savedSettings = await sql(`select coalesce(json_agg(json_build_object('key', key, 'value', value)), '[]') from "siteSetting" where key like 'loyalty.%'`);
    tokens.a = await register(phones.a, "E2E Points A");
    tokens.b = await register(phones.b, "E2E Points B");
    await register(phones.admin, "E2E Points Admin");
    await register(phones.owner, "E2E Points Owner");
    // Staff without full access (owner-only means OWNER or legacy ADMIN since PR #10).
    await sql(`update "user" set role='OPERATOR' where phone='${phones.admin}'`);
    await sql(`update "user" set role='OWNER' where phone='${phones.owner}'`);
    tokens.admin = await login(phones.admin);
    tokens.owner = await login(phones.owner);
    ids.a = Number(await sql(`select id from "user" where phone='${phones.a}'`));
    ids.b = Number(await sql(`select id from "user" where phone='${phones.b}'`));

    const created = await call("POST", "/api/admin/packages", {
      token: tokens.owner,
      body: {
        name: `E2E Loyalty ${RUN}`,
        slug,
        serviceType: "IPTV",
        isActive: true,
        options: [
          { durationValue: 3, durationUnit: "MONTH", price: 6000 },
          // The owner's override: this length earns 40 points instead of 10.
          { durationValue: 6, durationUnit: "MONTH", price: 10000, pointsEarned: 40 },
        ],
      },
    });
    assert.equal(created.status, 201, created.data?.message);
    ids.package = created.data.package.id;
    for (const row of (await sql(`select "durationMonths"||'|'||id||'|'||coalesce("pointsEarned"::text,'-') from "packageOption" where "packageId"=${ids.package}`)).split("\n")) {
      const [months, id, points] = row.split("|");
      option[months] = { id: Number(id), points };
    }
    assert.equal(option[6].points, "40", "pointsEarned saved from the package form");
    assert.equal(option[3].points, "-", "empty = automatic");

    await setSetting("loyalty.enabled", "off");
    await setSetting("loyalty.pendingDays", "0");
    await setSetting("loyalty.cooldownDays", "90");
    await setSetting("loyalty.reward3mPoints", "30");
    await setSetting("loyalty.reward6mPoints", "60");
    await setSetting("loyalty.reward3mOptionId", String(option[3].id));
    await setSetting("loyalty.reward6mOptionId", String(option[6].id));
  });

  // ------------------------------------------------------------ program off
  await check("program off: hidden from the app, and an order completed now never earns", async () => {
    assert.deepEqual(await loyalty(tokens.a), { enabled: false });
    const r = await call("POST", "/api/mobile/orders", { token: tokens.a, body: { requestType: "NEW", planSlug: slug, optionId: option[3].id } });
    assert.equal(r.status, 201, r.data?.message);
    ids.first = r.data.order.id;
    const act = await payAndActivate(ids.first, ids.a, 6000);
    assert.ok(act.status < 300, `activate ${act.status} ${act.data?.message ?? ""}`);
    ids.subA = Number(await sql(`select id from subscription where "userId"=${ids.a}`));
    assert.equal(await entries(ids.a), "");
    const redeem = await call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "3m", subscriptionId: ids.subA } });
    assert.equal(redeem.status, 409, "no redemption while off");
  });

  // ------------------------------------------------------------ earning
  await check("completing a paid IPTV renewal earns exactly once (price from the server, override honoured)", async () => {
    await setSetting("loyalty.enabled", "on");
    const r = await call("POST", "/api/mobile/orders", { token: tokens.a, body: { requestType: "RENEW", planSlug: slug, optionId: option[6].id, subscriptionId: ids.subA, price: 1, points: 999 } });
    assert.equal(r.status, 201, r.data?.message);
    ids.renew = r.data.order.id;
    assert.equal(await sql(`select price from "subscriptionRequest" where id=${ids.renew}`), "10000", "client price ignored");
    const act = await payAndActivate(ids.renew, ids.a, 10000);
    assert.ok(act.status < 300, `activate ${act.status} ${act.data?.message ?? ""}`);
    assert.equal(await entries(ids.a), "EARN:40");

    const again = await activate(ids.renew, ids.a, 10000);
    assert.equal(again.status, 400, "a completed order can't be activated twice");
    assert.equal(await entries(ids.a), "EARN:40", "still one EARN");
    assert.equal(await sql(`select count(*) from notification where "dedupeKey"='loyalty-earn:order:${ids.renew}'`), "1");

    const view = await loyalty(tokens.a);
    assert.equal(view.enabled, true);
    assert.equal(view.available, 40);
    assert.equal(view.entries[0].orderNumber, `SH-${String(ids.renew).padStart(6, "0")}`);
  });

  // ------------------------------------------------------------ security
  await check("another customer's subscription, no token, or a bad reward → refused with no change", async () => {
    const before = await entries(ids.a);
    assert.equal((await call("POST", "/api/mobile/loyalty/redeem", { body: { reward: "3m", subscriptionId: ids.subA } })).status, 401);
    assert.equal((await call("GET", "/api/mobile/loyalty")).status, 401);
    await sql(`insert into "loyaltyEntry" ("userId", kind, points, "availableAt", "idempotencyKey", rule) values (${ids.b}, 'ADJUST', 50, now(), 'e2e-${RUN}-b', '{}')`);
    await sql(`insert into "loyaltyAccount" ("userId", balance, "updatedAt") values (${ids.b}, 50, now())`);
    const cross = await call("POST", "/api/mobile/loyalty/redeem", { token: tokens.b, body: { reward: "3m", subscriptionId: ids.subA, userId: ids.a } });
    assert.ok([404, 409].includes(cross.status), `cross-customer ${cross.status}`);
    assert.equal(await balance(ids.b), 50, "B's points untouched");
    assert.equal(await sql(`select count(*) from "subscriptionRequest" where "userId"=${ids.b}`), "0");
    assert.equal((await call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "12m", subscriptionId: ids.subA } })).status, 400);
    assert.equal(await entries(ids.a), before);
  });

  // ------------------------------------------------------------ concurrency
  await check("two simultaneous redemptions: exactly one succeeds", async () => {
    const [x, y] = await Promise.all([
      call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "3m", subscriptionId: ids.subA } }),
      call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "3m", subscriptionId: ids.subA } }),
    ]);
    assert.deepEqual([x.status, y.status].sort(), [201, 409], `${x.status}/${y.status}`);
    const won = x.status === 201 ? x : y;
    ids.reward = won.data.order.id;
    assert.equal(won.data.order.loyaltyReward, true);
    assert.equal(await balance(ids.a), 10);
    assert.equal(await sql(`select price||'|'||"requestType"||'|'||"loyaltyReward"||'|'||status||'|'||"durationMonths"||'|'||"subscriptionId" from "subscriptionRequest" where id=${ids.reward}`), `0|RENEW|true|SUBMITTED|3|${ids.subA}`);
    assert.equal(await sql(`select count(*) from "subscriptionRequest" where "userId"=${ids.a} and "loyaltyReward"`), "1", "one reward order");
    assert.equal(await sql(`select "openRewardOrderId" from "loyaltyAccount" where "userId"=${ids.a}`), String(ids.reward));
  });

  // ------------------------------------------------------------ approval
  await check("only the owner approves a reward; staff can't activate it before approval", async () => {
    const early = await activate(ids.reward, ids.a, 0, {}, tokens.admin);
    assert.equal(early.status, 403, `activate before approval ${early.status}`);
    const admin = await call("PATCH", `/api/admin/subscription-requests/${ids.reward}`, { token: tokens.admin, body: { status: "PAID" } });
    assert.equal(admin.status, 400);
    assert.match(admin.data.message, /للمالك فقط/);
    const noPayment = await call("PATCH", `/api/admin/subscription-requests/${ids.reward}`, { token: tokens.owner, body: { status: "AWAITING_PAYMENT" } });
    assert.equal(noPayment.status, 400, "a reward has no payment step");
    assert.equal(await sql(`select status from "subscriptionRequest" where id=${ids.reward}`), "SUBMITTED");
    assert.equal((await call("PATCH", `/api/admin/subscription-requests/${ids.reward}`, { token: tokens.a, body: { status: "PAID" } })).status, 403, "a customer token is refused");
  });

  await check("rejecting a reward returns the points once and frees the slot", async () => {
    const r = await call("PATCH", `/api/admin/subscription-requests/${ids.reward}`, { token: tokens.owner, body: { status: "REJECTED" } });
    assert.equal(r.status, 200, r.data?.message);
    assert.equal(await entries(ids.a), "EARN:40,REDEEM:-30,REDEEM_RETURN:30");
    assert.equal(await balance(ids.a), 40);
    assert.equal(await sql(`select coalesce("openRewardOrderId"::text,'-')||'|'||coalesce("lastRedeemedAt"::text,'-') from "loyaltyAccount" where "userId"=${ids.a}`), "-|-", "slot free, cooldown not used");
  });

  await check("the customer can cancel a reward before approval and gets the points back", async () => {
    const r = await call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "3m", subscriptionId: ids.subA } });
    assert.equal(r.status, 201, r.data?.message);
    const cancel = await call("POST", `/api/mobile/orders/${r.data.order.id}/cancel`, { token: tokens.a });
    assert.equal(cancel.status, 200, cancel.data?.message);
    assert.equal(await balance(ids.a), 40);
    assert.equal(await sql(`select count(*) from "loyaltyEntry" where "idempotencyKey"='redeem-return:order:${r.data.order.id}'`), "1");
  });

  await check("an approved reward is activated as a free renewal of the reward length", async () => {
    const r = await call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "3m", subscriptionId: ids.subA } });
    assert.equal(r.status, 201, r.data?.message);
    ids.reward2 = r.data.order.id;

    // A normal checkout for the same plan, length and subscription must not reuse or re-price the reward.
    const paidRenew = await call("POST", "/api/mobile/orders", { token: tokens.a, body: { requestType: "RENEW", planSlug: slug, optionId: option[3].id, subscriptionId: ids.subA } });
    assert.equal(paidRenew.status, 201, paidRenew.data?.message);
    assert.notEqual(paidRenew.data.order.id, ids.reward2, "a separate paid order");
    assert.equal(await sql(`select price||'|'||"loyaltyReward" from "subscriptionRequest" where id=${ids.reward2}`), "0|true", "the reward is untouched");
    assert.equal(await sql(`select price||'|'||"loyaltyReward" from "subscriptionRequest" where id=${paidRenew.data.order.id}`), "6000|false");
    await call("POST", `/api/mobile/orders/${paidRenew.data.order.id}/cancel`, { token: tokens.a });

    const expiryBefore = await sql(`select to_char("expiryDate", 'YYYY-MM-DD') from subscription where id=${ids.subA}`);
    const approve = await call("PATCH", `/api/admin/subscription-requests/${ids.reward2}`, { token: tokens.owner, body: { status: "PAID" } });
    assert.equal(approve.status, 200, approve.data?.message);
    assert.equal((await activate(ids.reward2, ids.a, 5000)).status, 400, "a reward activates at price 0 only");
    assert.equal((await activate(ids.reward2, ids.a, 0, { durationMonths: 12 })).status, 400, "and at its own length only");
    const act = await activate(ids.reward2, ids.a, 0);
    assert.ok(act.status < 300, `activate ${act.status} ${act.data?.message ?? ""}`);
    assert.equal(await sql(`select to_char("expiryDate", 'YYYY-MM-DD') from subscription where id=${ids.subA}`), addMonths(expiryBefore, 3));
    assert.equal(await sql(`select status from "subscriptionRequest" where id=${ids.reward2}`), "COMPLETED");
    assert.equal(await entries(ids.a), "EARN:40,REDEEM:-30,REDEEM_RETURN:30,REDEEM:-30,REDEEM_RETURN:30,REDEEM:-30", "the reward order earns nothing");
    assert.equal(await sql(`select coalesce("openRewardOrderId"::text,'-') from "loyaltyAccount" where "userId"=${ids.a}`), "-");
    assert.equal(await sql(`select price from receipt where "orderId"=${ids.reward2}`), "0");
  });

  await check("the cooldown blocks the next redemption and says until when", async () => {
    await sql(`insert into "loyaltyEntry" ("userId", kind, points, "availableAt", "idempotencyKey", rule) values (${ids.a}, 'ADJUST', 30, now(), 'e2e-${RUN}-a', '{}')`);
    await sql(`update "loyaltyAccount" set balance = balance + 30 where "userId"=${ids.a}`);
    const view = await loyalty(tokens.a);
    assert.equal(view.rewards[0].problem?.code, "COOLDOWN");
    assert.ok(view.rewards[0].problem?.until);
    assert.equal((await call("POST", "/api/mobile/loyalty/redeem", { token: tokens.a, body: { reward: "3m", subscriptionId: ids.subA } })).status, 409);
  });

  await check("balances always equal the ledger", async () => {
    for (const userId of [ids.a, ids.b]) assert.equal(await balance(userId), await ledger(userId), `user ${userId}`);
  });

  // ------------------------------------------------------------ expiry
  await check("the whole balance expires 6 months after the latest IPTV expiry (written once, on read)", async () => {
    await sql(`update subscription set "expiryDate" = now() - interval '7 months' where "userId"=${ids.a}`);
    const first = await loyalty(tokens.a);
    await loyalty(tokens.a);
    assert.equal(first.balance, 0);
    assert.equal(await sql(`select count(*) from "loyaltyEntry" where "userId"=${ids.a} and kind='EXPIRE'`), "1");
    assert.equal(await balance(ids.a), await ledger(ids.a));
  });

  // ------------------------------------------------------------ seed
  await check("the launch seed gives each eligible customer one gift, even when run twice", async () => {
    // A has a paid, completed IPTV order; make the subscription active again.
    await sql(`update subscription set "expiryDate" = now() + interval '30 days', status='ACTIVE' where "userId"=${ids.a}`);
    const env = { ...process.env };
    const run = () => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/loyalty/seed.mjs"], { env, encoding: "utf8" });
    const check1 = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/loyalty/seed.mjs", "--check"], { env, encoding: "utf8" });
    assert.match(check1, /mode: check/);
    assert.equal(await sql(`select count(*) from "loyaltyEntry" where kind='SEED' and "userId"=${ids.a}`), "0", "--check writes nothing");
    run();
    run();
    assert.equal(await sql(`select count(*) from "loyaltyEntry" where kind='SEED' and "userId"=${ids.a}`), "1");
    assert.equal(await sql(`select count(*) from "loyaltyEntry" where kind='SEED' and "userId"=${ids.b}`), "0", "B has no paid order");
    assert.equal(await balance(ids.a), await ledger(ids.a));
  });
} finally {
  // ------------------------------------------------------------ cleanup (rows of this run only)
  try {
    const users = await sql(`select string_agg(id::text, ',') from "user" where phone in ('${phones.a}','${phones.b}','${phones.admin}','${phones.owner}')`);
    // The seed may have gifted other local customers during this run: undo exactly those entries.
    await sql(`delete from "loyaltyEntry" where kind='SEED' and "createdAt" >= '${startedAt}'`);
    await sql(`update "loyaltyAccount" a set balance = coalesce((select sum(points) from "loyaltyEntry" e where e."userId" = a."userId"), 0)`);
    await sql(`delete from "loyaltyAccount" a where "createdAt" >= '${startedAt}' and not exists (select 1 from "loyaltyEntry" e where e."userId" = a."userId")`);
    if (users) {
      await sql(`delete from "loyaltyEntry" where "userId" in (${users})`);
      await sql(`delete from "loyaltyAccount" where "userId" in (${users})`);
      await sql(`delete from receipt where "userId" in (${users})`);
      await sql(`delete from "subscriptionRequest" where "userId" in (${users})`);
      await sql(`delete from subscription where "userId" in (${users})`);
      await sql(`delete from notification where "userId" in (${users})`);
      await sql(`delete from "activityEvent" where "userId" in (${users}) or "actorUserId" in (${users})`);
      await sql(`delete from "user" where id in (${users})`);
    }
    await sql(`delete from "activityEvent" where action='LOYALTY_SEEDED' and "createdAt" >= '${startedAt}'`);
    await sql(`delete from "packageOption" where "packageId" in (select id from package where slug = '${slug}')`);
    await sql(`delete from "activityEvent" where "entityType"='PACKAGE' and "entityId" in (select id::text from package where slug = '${slug}')`);
    await sql(`delete from package where slug = '${slug}'`);
    await sql(`delete from "siteSetting" where key like 'loyalty.%'`);
    for (const row of JSON.parse(savedSettings || "[]")) await setSetting(row.key, String(row.value).replace(/'/g, "''"));
  } catch (error) {
    console.error("cleanup failed:", String(error?.message ?? error).split("\n")[0]);
  }
  await pgClient?.end();
}

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ""}`);
const failed = results.filter(([status]) => status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
