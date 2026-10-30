import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const duration = await import("@/src/lib/subscription-duration");
const catalogue = await import("@/src/lib/catalogue");

const INITIAL = [
  { slug: "iptv-3m", months: 3, price: 6000, ar: "3 أشهر" },
  { slug: "iptv-6m", months: 6, price: 10000, ar: "6 أشهر" },
  { slug: "iptv-12m", months: 12, price: 15000, ar: "سنة واحدة" },
  { slug: "iptv-24m", months: 24, price: 25000, ar: "سنتان" },
];

test("admin duration input: value + unit, whole numbers, 1 month to 5 years", () => {
  assert.deepEqual(duration.parseDuration(3, "MONTH"), { ok: true, months: 3, unit: "MONTH" });
  assert.deepEqual(duration.parseDuration(6, "month"), { ok: true, months: 6, unit: "MONTH" });
  assert.deepEqual(duration.parseDuration(1, "YEAR"), { ok: true, months: 12, unit: "YEAR" });
  assert.deepEqual(duration.parseDuration(2, "YEAR"), { ok: true, months: 24, unit: "YEAR" });
  assert.deepEqual(duration.parseDuration(60, "MONTH"), { ok: true, months: 60, unit: "MONTH" });
  assert.deepEqual(duration.parseDuration(5, "YEAR"), { ok: true, months: 60, unit: "YEAR" });

  for (const [value, unit] of [
    [0, "MONTH"],
    [-3, "MONTH"],
    [1.5, "MONTH"],
    ["6", "MONTH"],
    [null, "MONTH"],
    [Number.NaN, "MONTH"],
    [61, "MONTH"],
    [6, "YEAR"],
    [3, "DAY"],
    [3, "WEEK"],
  ] as const) {
    const result = duration.parseDuration(value, unit);
    assert.equal(result.ok, false, `${String(value)} ${unit} must be rejected`);
    if (!result.ok) assert.ok(result.error.length > 0, "a clear message is returned");
  }
});

test("package write resolves duration on the server (form, legacy months, VIP rule, labels)", () => {
  assert.deepEqual(duration.resolvePackageDuration({ durationValue: 6, durationUnit: "MONTH" }, "IPTV"), { ok: true, durationMonths: 6, durationUnit: "MONTH", durationLabel: "6 أشهر" });
  assert.deepEqual(duration.resolvePackageDuration({ durationValue: 2, durationUnit: "YEAR" }, "IPTV"), { ok: true, durationMonths: 24, durationUnit: "YEAR", durationLabel: "سنتان" });
  // The older API shape (months only) still works.
  assert.deepEqual(duration.resolvePackageDuration({ durationMonths: 12 }, "IPTV"), { ok: true, durationMonths: 12, durationUnit: "MONTH", durationLabel: "سنة واحدة" });
  // A custom label is kept (trimmed, bounded).
  const custom = duration.resolvePackageDuration({ durationValue: 3, durationUnit: "MONTH", durationLabel: "  3 أشهر + أسبوع هدية  " }, "IPTV");
  assert.ok(custom.ok && custom.durationLabel === "3 أشهر + أسبوع هدية");
  // VIP keeps the existing fixed three months whatever is sent.
  const vip = duration.resolvePackageDuration({ durationValue: 5, durationUnit: "YEAR" }, "VIP");
  assert.ok(vip.ok && vip.durationMonths === 3);
  // Invalid input is refused, not coerced.
  assert.equal(duration.resolvePackageDuration({ durationValue: -1, durationUnit: "MONTH" }, "IPTV").ok, false);
  assert.equal(duration.resolvePackageDuration({ durationValue: "12", durationUnit: "MONTH" }, "IPTV").ok, false);
  assert.equal(duration.resolvePackageDuration({}, "IPTV").ok, false);
  // A status-only edit carries no duration fields and leaves the duration alone.
  assert.equal(duration.hasDurationFields({ isActive: false }), false);
  assert.equal(duration.hasDurationFields({ durationLabel: "x" }), true);
});

test("form shows the duration the way it was entered", () => {
  assert.deepEqual(duration.durationValue(24, "YEAR"), { value: 2, unit: "YEAR" });
  assert.deepEqual(duration.durationValue(6, "MONTH"), { value: 6, unit: "MONTH" });
  assert.deepEqual(duration.durationValue(18, "YEAR"), { value: 18, unit: "MONTH" }, "uneven years fall back to months");
  assert.equal(duration.normalizeDurationUnit("year"), "YEAR");
  assert.equal(duration.normalizeDurationUnit(undefined), "MONTH");
});

test("Arabic duration wording agrees with the number", () => {
  assert.equal(duration.formatDurationAr(1), "شهر واحد");
  assert.equal(duration.formatDurationAr(2), "شهران");
  assert.equal(duration.formatDurationAr(3), "3 أشهر");
  assert.equal(duration.formatDurationAr(6), "6 أشهر");
  assert.equal(duration.formatDurationAr(11), "11 شهرًا");
  assert.equal(duration.formatDurationAr(12), "سنة واحدة");
  assert.equal(duration.formatDurationAr(18), "18 شهرًا");
  assert.equal(duration.formatDurationAr(24), "سنتان");
  assert.equal(duration.formatDurationAr(36), "3 سنوات");
  assert.equal(duration.formatDuration(6, "en"), "6 months");
  assert.equal(duration.formatDuration(12, "en"), "1 year");
  assert.equal(duration.formatDuration(24, "en"), "2 years");
});

test("expiry for each initial package duration", () => {
  const start = "2026-10-16";
  const expected: Record<number, string> = { 3: "2027-01-16", 6: "2027-04-16", 12: "2027-10-16", 24: "2028-10-16" };

  for (const pkg of INITIAL) {
    assert.equal(duration.addMonthsClamped(start, pkg.months), expected[pkg.months], `${pkg.months} months`);
  }
});

test("expiry never spills into the next month and rejects bad input", () => {
  assert.equal(duration.addMonthsClamped("2026-08-31", 6), "2027-02-28", "31 Aug + 6 months = end of Feb");
  assert.equal(duration.addMonthsClamped("2027-08-31", 6), "2028-02-29", "leap year");
  assert.equal(duration.addMonthsClamped("2026-11-30", 3), "2027-02-28");
  assert.equal(duration.addMonthsClamped("2026-12-31", 3), "2027-03-31");
  assert.equal(duration.addMonthsClamped("2028-02-29", 12), "2029-02-28");
  assert.equal(duration.addMonthsClamped("2026-10-16T00:00:00.000Z", 3), "2027-01-16", "a timestamp's date part is used");
  // Renewal from the current expiry stacks the purchased months.
  const firstTerm = duration.addMonthsClamped("2026-01-15", 3)!;
  assert.equal(duration.addMonthsClamped(firstTerm, 6), "2026-10-15");

  for (const [date, months] of [
    ["2026-02-30", 3],
    ["2026-13-01", 3],
    ["not a date", 3],
    ["2026-10-16", 0],
    ["2026-10-16", -1],
    ["2026-10-16", 1.5],
  ] as const) {
    assert.equal(duration.addMonthsClamped(date, months), null, `${date} + ${months}`);
  }
});

test("renewal lengths: any whole month count from 1 to 60 (3 and 6 month packages renew)", () => {
  for (const months of [1, 3, 6, 12, 24, 60]) assert.ok(duration.isValidDurationMonths(months));
  for (const months of [0, 61, 2.5, "12", null]) assert.ok(!duration.isValidDurationMonths(months));
});

test("monthly price used to compare packages", () => {
  assert.equal(duration.monthlyPrice(6000, 3), 2000);
  assert.equal(duration.monthlyPrice(10000, 6), 1667);
  assert.equal(duration.monthlyPrice(15000, 12), 1250);
  assert.equal(duration.monthlyPrice(25000, 24), 1042);
});

test("prices are validated as non-negative whole dinars", () => {
  for (const pkg of INITIAL) assert.ok(catalogue.isValidPrice(pkg.price));
  assert.ok(!catalogue.isValidPrice(-6000));
  assert.ok(!catalogue.isValidPrice("6000"));
});

type Op = { id: string; operationClass: string; execute: { sql: string }[]; postcheck: { sql: string; params?: unknown[] }[] };

function readOps(dir: string): Op[] {
  return JSON.parse(readFileSync(new URL(`../migrations/app/${dir}/ops.json`, import.meta.url), "utf8"));
}

test("IPTV seed: reuses iptv-1y / iptv-2y, adds missing durations, IPTV only, never deletes", () => {
  const ops = readOps("20261016T0559_package_duration_unit");

  assert.deepEqual(
    ops.map((op) => [op.id, op.operationClass]),
    [
      ["column.public.package.durationUnit", "additive"],
      ["data.public.package.canonical_iptv_packages", "data"],
    ],
  );

  const steps = ops[1].execute.map((step) => step.sql);
  const all = steps.join("\n");

  for (const statement of steps) {
    assert.match(statement, /"serviceType" = 'IPTV'|'IPTV'/, "every statement is limited to IPTV");
  }
  assert.doesNotMatch(all, /VIP/, "VIP packages are never read or written");
  assert.doesNotMatch(all, /\b(DELETE|DROP|TRUNCATE)\b/i, "nothing is removed");
  assert.doesNotMatch(all, /"isActive"\s*=\s*false/i, "nothing is disabled");

  // 12 / 24 months: the existing rows are repriced, guarded by slug + service + duration.
  assert.match(steps[0], /SET "price" = 15000, "durationUnit" = 'YEAR'.*WHERE "slug" = 'iptv-1y' AND "serviceType" = 'IPTV' AND "durationMonths" = 12/);
  assert.match(steps[1], /SET "price" = 25000, "durationUnit" = 'YEAR'.*WHERE "slug" = 'iptv-2y' AND "serviceType" = 'IPTV' AND "durationMonths" = 24/);
  for (const statement of steps.slice(0, 2)) assert.doesNotMatch(statement, /\bname\b|"name"|"slug" =\s*'iptv-(12|24)m'/, "slug and name are kept");

  // Inserts: all four canonical prices, only when no active IPTV package of that duration exists.
  const insert = steps[2];
  for (const pkg of INITIAL) assert.match(insert, new RegExp(`'${pkg.slug}', ${pkg.price}, ${pkg.months}, '(MONTH|YEAR)', '${pkg.ar}'`), pkg.slug);
  assert.match(insert, /NOT EXISTS \(\s*SELECT 1 FROM "public"\."package" p\s*WHERE p\."serviceType" = 'IPTV' AND p\."durationMonths" = v\.months AND p\."isActive"/);
  assert.match(insert, /ON CONFLICT \("slug"\) DO NOTHING/);
  assert.doesNotMatch(insert, /'IPTV سنة'|'IPTV سنتين'/, "fallback rows don't reuse legacy names (subscriptions match by name)");

  assert.match(ops[1].postcheck[0].sql, /count\(DISTINCT "durationMonths"\)[\s\S]*IN \(3, 6, 12, 24\)\) = 4/);
});

test("VIP renewal price migration: nullable column, VIP 3 months = 35,000 only when unset", () => {
  const ops = readOps("20261017T1832_package_renewal_price");

  assert.deepEqual(
    ops.map((op) => [op.id, op.operationClass]),
    [
      ["column.public.package.renewalPrice", "additive"],
      ["data.public.package.vip_renewal_price", "data"],
    ],
  );

  const update = ops[1].execute.map((step) => step.sql).join("\n");
  assert.match(update, /SET "renewalPrice" = 35000/);
  assert.match(update, /WHERE "serviceType" = 'VIP' AND "durationMonths" = 3 AND "renewalPrice" IS NULL/);
  assert.doesNotMatch(update, /IPTV|"price" =/, "IPTV and the VIP normal price are untouched");

  const migration = JSON.parse(readFileSync(new URL("../migrations/app/20261017T1832_package_renewal_price/migration.json", import.meta.url), "utf8"));
  const previous = JSON.parse(readFileSync(new URL("../migrations/app/20261016T0559_package_duration_unit/migration.json", import.meta.url), "utf8"));
  assert.equal(migration.from, previous.to, "chained after the IPTV seed");
});

test("package options migration: additive table and order column, one option per existing package", () => {
  const ops = readOps("20261030T1021_package_options");

  assert.deepEqual(
    ops.map((op) => op.operationClass),
    ["additive", "additive", "additive", "additive", "additive", "data"],
    "nothing is dropped or rewritten",
  );
  assert.ok(ops.some((op) => op.id === "table.packageOption"));
  assert.ok(ops.some((op) => op.id === "column.public.subscriptionRequest.packageOptionId"));
  assert.ok(ops.some((op) => op.id === "unique.packageOption.packageOption_packageId_durationMonths_key"), "one option per length per package");

  const backfill = ops.find((op) => op.id === "data.public.packageOption.backfill_from_package");
  assert.ok(backfill, "the backfill data step");
  const insert = backfill.execute.map((step) => step.sql).join("\n");
  assert.match(insert, /INSERT INTO "public"\."packageOption"/);
  assert.match(insert, /SELECT p\."id", p\."durationMonths", p\."durationUnit", p\."durationLabel", p\."price", p\."renewalPrice"/, "copies the package's own length and prices");
  assert.match(insert, /WHERE NOT EXISTS \(SELECT 1 FROM "public"\."packageOption" o WHERE o\."packageId" = p\."id"\)/, "only packages without an option: safe to run again");
  assert.doesNotMatch(insert, /UPDATE|DELETE/, "packages, orders and subscriptions are only read");
  assert.match(backfill.postcheck[0].sql, /o\."durationMonths" = p\."durationMonths" AND o\."price" = p\."price"/);

  const migration = JSON.parse(readFileSync(new URL("../migrations/app/20261030T1021_package_options/migration.json", import.meta.url), "utf8"));
  const previous = JSON.parse(readFileSync(new URL("../migrations/app/20261017T1832_package_renewal_price/migration.json", import.meta.url), "utf8"));
  const next = JSON.parse(readFileSync(new URL("../migrations/app/20261030T1747_loyalty_points/migration.json", import.meta.url), "utf8"));
  assert.equal(migration.from, previous.to, "chained after the VIP renewal price");
  assert.equal(migration.to, next.from, "the loyalty migration follows it");
});

test("order price: renewals use the renewal price; VIP renewal has no device; client values are ignored", () => {
  const vip = { price: 45000, renewalPrice: 35000 };
  const iptv = { price: 15000, renewalPrice: null };

  assert.equal(catalogue.planOrderPrice(vip, "NEW", 80000), 125000, "VIP new = plan + device");
  assert.equal(catalogue.planOrderPrice(vip, "RENEW", 80000), 35000, "VIP renewal = renewal price, never the device");
  assert.equal(catalogue.planOrderPrice(vip, "renew"), 35000);
  assert.equal(catalogue.planOrderPrice(vip, "UPGRADE", 80000), 125000);
  assert.equal(catalogue.planOrderPrice(iptv, "RENEW"), 15000, "no renewal price = normal price");
  assert.equal(catalogue.planOrderPrice({ price: 6000 }, "RENEW"), 6000);
  assert.equal(catalogue.planOrderPrice(iptv, "NEW"), 15000);

  assert.deepEqual(catalogue.parseRenewalPrice(""), { ok: true, value: null });
  assert.deepEqual(catalogue.parseRenewalPrice(null), { ok: true, value: null });
  assert.deepEqual(catalogue.parseRenewalPrice(35000), { ok: true, value: 35000 });
  for (const bad of [-1, 1.5, "35000", Number.NaN]) assert.equal(catalogue.parseRenewalPrice(bad).ok, false, String(bad));
});
