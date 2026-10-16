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

test("seed migration: the four IQD packages, insert-only, idempotent", () => {
  const dir = new URL("../migrations/app/20261016T0559_package_duration_unit/", import.meta.url);
  const ops = JSON.parse(readFileSync(new URL("ops.json", dir), "utf8")) as { id: string; operationClass: string; execute: { sql: string }[]; postcheck: { sql: string; params?: unknown[] }[] }[];

  assert.deepEqual(
    ops.map((op) => [op.id, op.operationClass]),
    [
      ["column.public.package.durationUnit", "additive"],
      ["data.public.package.seed_initial_subscription_packages", "data"],
    ],
  );

  const seed = ops[1];
  const sql = seed.execute.map((step) => step.sql).join("\n");

  assert.match(sql, /ON CONFLICT \("slug"\) DO NOTHING/, "existing slugs are left untouched");
  assert.doesNotMatch(sql, /\b(UPDATE|DELETE|DROP|TRUNCATE)\b/i, "never changes or removes existing data");

  for (const pkg of INITIAL) {
    assert.match(sql, new RegExp(`'${pkg.slug}', 'IPTV', ${pkg.price}, ${pkg.months}, '(MONTH|YEAR)', '${pkg.ar}'`), pkg.slug);
  }

  assert.deepEqual(seed.postcheck[0].params, [INITIAL.map((pkg) => pkg.slug)]);

  const migration = JSON.parse(readFileSync(new URL("migration.json", dir), "utf8"));
  const ref = JSON.parse(readFileSync(new URL("../migrations/app/refs/db.json", import.meta.url), "utf8"));
  assert.equal(migration.to, ref.hash, "the db ref points at this migration's contract");
});
