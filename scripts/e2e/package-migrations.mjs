#!/usr/bin/env node
/**
 * Verifies the package migrations on a THROWAWAY database, never on the dev
 * database: 20261016T0559_package_duration_unit (canonical IPTV packages) and
 * 20261017T1832_package_renewal_price (VIP renewal price).
 *
 *   set -a; . ./.env.local; set +a
 *   node scripts/e2e/package-migrations.mjs
 *
 * It creates `shashtna_migcheck_<run>` on the same LOCAL server (refuses any
 * non-local DATABASE_URL), runs every migration from empty with the Prisma
 * CLI, then replays the two data steps against prepared package tables in that
 * scratch database, and drops it at the end. The dev database is not touched.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DB = process.env.DATABASE_URL ?? "";

if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(DB)) {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(2);
}

const RUN = Date.now().toString().slice(-7);
const scratchName = `shashtna_migcheck_${RUN}`;
const scratchUrl = (() => {
  const url = new URL(DB);
  url.pathname = `/${scratchName}`;
  return url.toString();
})();
/** Never let a connection string (credentials) reach the output. */
const redact = (text) => String(text).replace(/postgres(ql)?:\/\/\S+/gi, "<database-url>");
const psql = (url, query) => {
  try {
    return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-Atc", query], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    throw new Error(redact(error.stderr || error.message));
  }
};
const sql = (query) => psql(scratchUrl, query);
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (error) {
    results.push(["FAIL", name, redact(String(error?.message ?? error).split("\n")[0])]);
  }
}

function dataStep(dir) {
  const ops = JSON.parse(readFileSync(new URL(`../../migrations/app/${dir}/ops.json`, import.meta.url), "utf8"));
  const op = ops.find((item) => item.operationClass === "data");
  return {
    run: () => sql(["BEGIN;", ...op.execute.map((step) => `${step.sql};`), "COMMIT;"].join("\n")),
    postcheck: () => op.postcheck.every((step) => sql(step.params ? step.sql.replace(/\$1::text\[\]/g, `'{${step.params[0].join(",")}}'::text[]`) : step.sql) === "t"),
  };
}

const iptvStep = dataStep("20261016T0559_package_duration_unit");
const vipStep = dataStep("20261017T1832_package_renewal_price");

const packages = () =>
  sql(`select string_agg(slug||':'||"serviceType"||':'||price||':'||coalesce("renewalPrice"::text,'-')||':'||"durationMonths"||':'||"isActive", ' ' order by slug) from package`);
const snapshot = () => sql(`select string_agg(id||':'||price||':'||coalesce("renewalPrice"::text,'-')||':'||"isActive"||':'||"updatedAt", ' ' order by id) from package`);

/** Scratch-only: replaces the package table contents with the given rows. */
function preparePackages(rows) {
  sql(`TRUNCATE "packageDevice", package RESTART IDENTITY CASCADE`);
  for (const row of rows) {
    sql(`INSERT INTO package (name, slug, "serviceType", price, "durationMonths", "durationLabel", description, specifications, "isActive", "updatedAt")
         VALUES ('${row.name}', '${row.slug}', '${row.type}', ${row.price}, ${row.months}, '${row.label ?? row.months}', 'd', 's', ${row.active ?? true}, now())`);
  }
}

const LEGACY = [
  { name: "IPTV سنة", slug: "iptv-1y", type: "IPTV", price: 35000, months: 12 },
  { name: "IPTV سنتين", slug: "iptv-2y", type: "IPTV", price: 60000, months: 24 },
  { name: "VIP 3 أشهر", slug: "vip-3m", type: "VIP", price: 45000, months: 3 },
];

try {
  psql(DB, `CREATE DATABASE ${scratchName}`);

  await check("all migrations apply from empty with the Prisma CLI (no legacy packages)", async () => {
    execFileSync("npx", ["prisma", "db", "migrate", "--db", scratchUrl], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(
      packages(),
      "iptv-12m:IPTV:15000:-:12:true iptv-24m:IPTV:25000:-:24:true iptv-3m:IPTV:6000:-:3:true iptv-6m:IPTV:10000:-:6:true",
      "all four canonical IPTV packages, inserted under their fallback slugs",
    );
    execFileSync("npx", ["prisma", "db", "verify", "--db", scratchUrl], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  });

  await check("legacy iptv-1y / iptv-2y are reused and repriced; VIP normal price untouched; VIP renewal 35,000", async () => {
    preparePackages(LEGACY);
    sql(`UPDATE package SET "renewalPrice" = NULL`);
    iptvStep.run();
    vipStep.run();
    assert.equal(
      packages(),
      [
        "iptv-1y:IPTV:15000:-:12:true",
        "iptv-2y:IPTV:25000:-:24:true",
        "iptv-3m:IPTV:6000:-:3:true",
        "iptv-6m:IPTV:10000:-:6:true",
        "vip-3m:VIP:45000:35000:3:true",
      ].join(" "),
    );
    assert.equal(sql(`select name from package where slug='iptv-1y'`), "IPTV سنة", "name kept (old subscriptions match by name)");
    assert.ok(iptvStep.postcheck() && vipStep.postcheck(), "postchecks pass");
  });

  await check("re-running both data steps changes nothing (idempotent)", async () => {
    const before = snapshot();
    iptvStep.run();
    vipStep.run();
    assert.equal(snapshot(), before);
  });

  await check("historical orders, receipts and subscriptions keep their recorded prices", async () => {
    preparePackages(LEGACY);
    const user = sql(`INSERT INTO "user" (name, phone, "passwordHash", role, "updatedAt") VALUES ('m', '0700${RUN}', 'x', 'CUSTOMER', now()) RETURNING id`).split("\n")[0];
    sql(`INSERT INTO "subscriptionRequest" ("userId", "planSlug", "requestType", "serviceType", "serviceName", price, "durationMonths", "durationLabel", status, "contactMethod", "updatedAt")
         VALUES (${user}, 'iptv-1y', 'NEW', 'IPTV', 'IPTV سنة', 35000, 12, 'سنة واحدة', 'COMPLETED', 'PENDING', now()),
                (${user}, 'vip-3m', 'NEW', 'VIP', 'VIP 3 أشهر', 125000, 3, '3 Months', 'COMPLETED', 'PENDING', now())`);
    sql(`INSERT INTO receipt ("receiptNumber", "userId", "subscriptionId", "serviceType", "serviceName", price, "durationMonths", "durationLabel") VALUES ('R-${RUN}', ${user}, 1, 'IPTV', 'IPTV سنة', 35000, 12, 'سنة واحدة')`);
    const before = sql(`select string_agg(price::text, ',' order by id) from "subscriptionRequest"`) + "|" + sql(`select string_agg(price::text, ',') from receipt`);
    iptvStep.run();
    vipStep.run();
    assert.equal(sql(`select string_agg(price::text, ',' order by id) from "subscriptionRequest"`) + "|" + sql(`select string_agg(price::text, ',') from receipt`), before);
    assert.equal(before, "35000,125000|35000");
  });

  await check("no duplicate duration: another active 12-month IPTV package blocks the iptv-12m insert", async () => {
    preparePackages([{ name: "IPTV Annual", slug: "iptv-annual", type: "IPTV", price: 30000, months: 12 }]);
    iptvStep.run();
    assert.equal(sql(`select count(*) from package where "serviceType"='IPTV' and "durationMonths"=12 and "isActive"`), "1");
    assert.equal(sql(`select price from package where slug='iptv-annual'`), "30000", "an unrelated slug is never repriced");
    assert.equal(sql(`select count(*) from package where slug='iptv-12m'`), "0");
  });

  await check("legacy slug that is not the expected IPTV duration is left alone", async () => {
    preparePackages([{ name: "Odd", slug: "iptv-1y", type: "IPTV", price: 9999, months: 6 }]);
    iptvStep.run();
    assert.equal(sql(`select price||':'||"durationMonths" from package where slug='iptv-1y'`), "9999:6");
    assert.equal(sql(`select count(*) from package where slug in ('iptv-3m','iptv-12m','iptv-24m')`), "3", "the missing durations are added");
    assert.equal(sql(`select count(*) from package where slug='iptv-6m'`), "0", "6 months already offered by iptv-1y (6 months), no duplicate");
  });

  await check("VIP step never touches IPTV, and keeps a renewal price an admin already set", async () => {
    preparePackages(LEGACY);
    sql(`UPDATE package SET "renewalPrice" = 30000 WHERE slug='vip-3m'`);
    vipStep.run();
    assert.equal(sql(`select coalesce("renewalPrice"::text,'-') from package where slug='vip-3m'`), "30000");
    assert.equal(sql(`select count(*) from package where "serviceType"='IPTV' and "renewalPrice" is not null`), "0");
  });
} finally {
  try {
    psql(DB, `DROP DATABASE IF EXISTS ${scratchName}`);
  } catch (error) {
    console.error(`cleanup: scratch database ${scratchName} kept:`, redact(String(error?.message ?? error).split("\n")[0]));
  }
}

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ""}`);
const failed = results.filter(([status]) => status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
